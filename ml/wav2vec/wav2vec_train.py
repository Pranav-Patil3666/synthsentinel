import json
import math
import os
import random
import sys
from pathlib import Path
from typing import cast

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from torch.utils.data import DataLoader, WeightedRandomSampler
from transformers import (
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForSequenceClassification,
    get_linear_schedule_with_warmup,
)

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from wav2vec_dataset import Wav2VecAudioDataset



# CONFIG

# Switched from wav2vec2-large-xlsr-53 (300M) to wav2vec2-base (95M)

MODEL_NAME = "facebook/wav2vec2-base"
SEED = 42

TRAIN_BATCH_SIZE = 8
EVAL_BATCH_SIZE  = 8
GRAD_ACCUM_STEPS = 2

# More epochs affordable now with base model speed
EPOCHS   = 10
PATIENCE = 3


# Warmup protects against instability
LEARNING_RATE_BASE = 2e-5   
LEARNING_RATE_HEAD = 1e-4   
WEIGHT_DECAY       = 0.01
WARMUP_RATIO       = 0.1


MAX_DURATION = 2
SAMPLE_RATE  = 16000

LABEL2ID = {"REAL": 0, "FAKE": 1}
ID2LABEL  = {0: "REAL", 1: "FAKE"}


def seed_everything(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def worker_init_fn(worker_id: int) -> None:
    worker_seed = SEED + worker_id
    random.seed(worker_seed)
    np.random.seed(worker_seed)


def collate_fn(batch):
    input_values = torch.stack([item["input_values"] for item in batch])
    labels       = torch.stack([item["labels"] for item in batch])
    return {"input_values": input_values, "labels": labels}


def build_sampler(train_dataset: Wav2VecAudioDataset):
    labels       = [label for _, label in train_dataset.samples]
    class_counts = np.bincount(labels, minlength=2)

    if len(class_counts) < 2:
        raise ValueError("Train set must contain both real and fake samples.")

    class_weights  = len(labels) / np.maximum(class_counts, 1)
    sample_weights: list[float] = [
        float(class_weights[label]) for label in labels
    ]

    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True,
    )

    return sampler, class_counts


def find_best_threshold(y_true: np.ndarray, y_prob: np.ndarray):
    best_threshold = 0.5
    best_f1        = -1.0

    for thr in np.arange(0.10, 0.91, 0.01):
        y_pred = (y_prob >= thr).astype(int)
        score  = f1_score(y_true, y_pred, zero_division=0)
        if score > best_f1:
            best_f1        = score
            best_threshold = float(thr)

    return best_threshold, best_f1


def evaluate(
    model    : Wav2Vec2ForSequenceClassification,
    loader   : DataLoader,
    device   : torch.device,
    criterion: nn.CrossEntropyLoss,
):
    model.eval()

    total_loss = 0.0
    y_true: list = []
    y_prob: list = []
    y_pred: list = []

    with torch.no_grad():
        for batch in loader:
            input_values = batch["input_values"].to(device)
            labels       = batch["labels"].to(device)

            outputs = model(input_values=input_values)
            logits  = outputs.logits

            loss        = criterion(logits, labels)
            total_loss += loss.item()

            probs = torch.softmax(logits, dim=-1)[:, 1]
            preds = torch.argmax(logits, dim=-1)

            y_true.extend(labels.cpu().numpy())
            y_prob.extend(probs.cpu().numpy())
            y_pred.extend(preds.cpu().numpy())

    y_true_arr = np.asarray(y_true)
    y_prob_arr = np.asarray(y_prob)
    y_pred_arr = np.asarray(y_pred)

    metrics: dict = {
        "loss"     : total_loss / max(len(loader), 1),
        "accuracy" : accuracy_score(y_true_arr, y_pred_arr),
        "precision": precision_score(y_true_arr, y_pred_arr, zero_division=0),
        "recall"   : recall_score(y_true_arr, y_pred_arr, zero_division=0),
        "f1"       : f1_score(y_true_arr, y_pred_arr, zero_division=0),
    }

    try:
        metrics["roc_auc"] = roc_auc_score(y_true_arr, y_prob_arr)
    except Exception:
        metrics["roc_auc"] = 0.0

    try:
        metrics["pr_auc"] = average_precision_score(y_true_arr, y_prob_arr)
    except Exception:
        metrics["pr_auc"] = 0.0

    return metrics, y_true_arr, y_prob_arr


def save_bundle(
    save_dir : Path,
    model    : Wav2Vec2ForSequenceClassification,
    processor: Wav2Vec2FeatureExtractor,
) -> None:
    save_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(save_dir)
    processor.save_pretrained(save_dir)  # type: ignore[arg-type]


def main():
    seed_everything(SEED)

    if torch.cuda.is_available():
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.benchmark        = True

    base       = PROJECT_ROOT
    data_root  = base / "data" / "final"
    model_root = base / "models" / "wav2vec2_base"   # updated from wav2vec2_xlsr
    best_dir   = model_root / "best"
    last_dir   = model_root / "last"

    model_root.mkdir(parents=True, exist_ok=True)

    device  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = device.type == "cuda"
    print("Using device:", device)

    print("🔄 Loading feature extractor...")
    processor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_NAME)

    print("📦 Loading datasets...")
    train_dataset = Wav2VecAudioDataset(
        root_dir    =str(data_root / "train"),
        processor   =processor,
        sample_rate =SAMPLE_RATE,
        max_duration=MAX_DURATION,
        augment     =True,
    )

    val_dataset = Wav2VecAudioDataset(
        root_dir    =str(data_root / "val"),
        processor   =processor,
        sample_rate =SAMPLE_RATE,
        max_duration=MAX_DURATION,
        augment     =False,
    )

    sampler, class_counts = build_sampler(train_dataset)
    print("Class counts (train):", class_counts.tolist())

    # num_workers=0 — faster on Windows due to spawn overhead with librosa
    train_loader = DataLoader(
        train_dataset,
        batch_size      =TRAIN_BATCH_SIZE,
        sampler         =sampler,
        num_workers     =0,
        pin_memory      =use_amp,
        drop_last       =True,
        collate_fn      =collate_fn,
        worker_init_fn  =worker_init_fn,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size    =EVAL_BATCH_SIZE,
        shuffle       =False,
        num_workers   =0,
        pin_memory    =use_amp,
        drop_last     =False,
        collate_fn    =collate_fn,
        worker_init_fn=worker_init_fn,
    )

    print("🧠 Loading wav2vec2-base model...")
    model = cast(
        Wav2Vec2ForSequenceClassification,
        Wav2Vec2ForSequenceClassification.from_pretrained(
            MODEL_NAME,
            num_labels             =2,
            label2id               =LABEL2ID,
            id2label               =ID2LABEL,
            problem_type           ="single_label_classification",
            ignore_mismatched_sizes=True,
        )
    )

    # Mild regularization — dropout at 0.10 across all layers
    model.config.hidden_dropout      = 0.10
    model.config.attention_dropout   = 0.10
    model.config.activation_dropout  = 0.10
    model.config.feat_proj_dropout   = 0.10
    model.config.final_dropout       = 0.10
    model.config.classifier_proj_size = getattr(
        model.config, "classifier_proj_size", 256
    )

    # Freeze CNN feature encoder — only fine-tune transformer layers + head
    try:
        model.freeze_feature_encoder()
    except Exception:
        try:
            model.freeze_feature_extractor()  # type: ignore[attr-defined]
        except Exception:
            pass

    model.to(device)  # type: ignore[arg-type]

    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)

    # Differential LR — lower for pretrained transformer, higher for new head
    base_params: list = []
    head_params: list = []

    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        if name.startswith("wav2vec2."):
            base_params.append(param)
        else:
            head_params.append(param)

    optimizer = torch.optim.AdamW(  # type: ignore[attr-defined]
        [
            {"params": base_params, "lr": LEARNING_RATE_BASE},
            {"params": head_params, "lr": LEARNING_RATE_HEAD},
        ],
        weight_decay=WEIGHT_DECAY,
    )

    steps_per_epoch  = math.ceil(len(train_loader) / GRAD_ACCUM_STEPS)
    total_train_steps = steps_per_epoch * EPOCHS
    warmup_steps      = max(1, int(total_train_steps * WARMUP_RATIO))

    scheduler = get_linear_schedule_with_warmup(
        optimizer          =optimizer,
        num_warmup_steps   =warmup_steps,
        num_training_steps =total_train_steps,
    )

    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)  # type: ignore[attr-defined]

    best_auc      = -1.0
    best_threshold = 0.50
    no_improve     = 0
    summary_path   = model_root / "training_summary.json"

    for epoch in range(EPOCHS):
        model.train()
        optimizer.zero_grad(set_to_none=True)

        running_loss    = 0.0
        optimizer_steps = 0

        for step, batch in enumerate(train_loader):
            input_values = batch["input_values"].to(device)
            labels       = batch["labels"].to(device)

            with torch.amp.autocast("cuda", enabled=use_amp):  # type: ignore[attr-defined]
                outputs          = model(input_values=input_values)
                logits           = outputs.logits
                loss             = criterion(logits, labels)
                loss_to_backprop = loss / GRAD_ACCUM_STEPS

            scaler.scale(loss_to_backprop).backward()
            running_loss += loss.item()

            should_step = (
                (step + 1) % GRAD_ACCUM_STEPS == 0
            ) or (
                (step + 1) == len(train_loader)
            )

            if should_step:
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad(set_to_none=True)
                scheduler.step()
                optimizer_steps += 1

        train_loss = running_loss / max(len(train_loader), 1)

        val_metrics, y_true, y_prob = evaluate(
            model, val_loader, device, criterion
        )
        optimal_threshold, _ = find_best_threshold(y_true, y_prob)

        print(
            f"Epoch {epoch + 1}/{EPOCHS} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Val Loss: {val_metrics['loss']:.4f} | "
            f"Acc: {val_metrics['accuracy']:.4f} | "
            f"Prec: {val_metrics['precision']:.4f} | "
            f"Rec: {val_metrics['recall']:.4f} | "
            f"F1: {val_metrics['f1']:.4f} | "
            f"ROC AUC: {val_metrics['roc_auc']:.4f} | "
            f"PR AUC: {val_metrics['pr_auc']:.4f} | "
            f"Best Thr: {optimal_threshold:.2f}"
        )

        current_score = val_metrics["roc_auc"]

        if current_score > best_auc:
            best_auc       = current_score
            best_threshold = optimal_threshold
            no_improve     = 0

            save_bundle(best_dir, model, processor)

            best_summary = {
                "epoch"          : epoch + 1,
                "val_loss"       : float(val_metrics["loss"]),
                "accuracy"       : float(val_metrics["accuracy"]),
                "precision"      : float(val_metrics["precision"]),
                "recall"         : float(val_metrics["recall"]),
                "f1"             : float(val_metrics["f1"]),
                "roc_auc"        : float(val_metrics["roc_auc"]),
                "pr_auc"         : float(val_metrics["pr_auc"]),
                "best_threshold" : float(best_threshold),
                "class_counts"   : class_counts.tolist(),
                "model_name"     : MODEL_NAME,
            }

            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(best_summary, f, indent=2)

            print(f"✅ Best model saved → {best_dir}")

        else:
            no_improve += 1

        if no_improve >= PATIENCE:
            print(f"⏹ Early stopping triggered at epoch {epoch + 1}")
            break

    save_bundle(last_dir, model, processor)

    final_summary = {
        "best_roc_auc"    : float(best_auc),
        "best_threshold"  : float(best_threshold),
        "model_name"      : MODEL_NAME,
        "saved_best_dir"  : str(best_dir),
        "saved_last_dir"  : str(last_dir),
    }

    with open(model_root / "final_summary.json", "w", encoding="utf-8") as f:
        json.dump(final_summary, f, indent=2)

    print(f"\n✅ Training complete | Best ROC AUC: {best_auc:.4f}")
    print(f"✅ Best threshold   : {best_threshold:.2f}")
    print(f"✅ Best model dir   : {best_dir}")
    print(f"✅ Last model dir   : {last_dir}")


if __name__ == "__main__":
    main()