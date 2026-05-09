import json
import math
import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from torch.utils.data import DataLoader
from transformers import  Wav2Vec2ForSequenceClassification
from transformers import Wav2Vec2FeatureExtractor

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from wav2vec_dataset import Wav2VecAudioDataset


# =========================
# CONFIG
# =========================
BASE = PROJECT_ROOT
DATA_ROOT = BASE / "data" / "final"
MODEL_DIR = BASE / "models" / "wav2vec2_base" / "best"
RESULTS_DIR = BASE / "results" / "wav2vec2_base"

SAMPLE_RATE = 16000
MAX_DURATION = 4
BATCH_SIZE = 4
NUM_WORKERS = 2

LABEL_NAMES = ["REAL", "FAKE"]  # 0 = REAL, 1 = FAKE


def collate_fn(batch):
    input_values = torch.stack([item["input_values"] for item in batch])
    labels = torch.stack([item["labels"] for item in batch])
    return {"input_values": input_values, "labels": labels}


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def plot_confusion_matrix(cm, title, save_path):
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=LABEL_NAMES,
        yticklabels=LABEL_NAMES,
    )
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title(title)
    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def plot_roc_curve(fpr, tpr, auc_score, save_path):
    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, label=f"ROC AUC = {auc_score:.4f}")
    plt.plot([0, 1], [0, 1], linestyle="--", color="gray")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curve")
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def plot_pr_curve(recalls, precisions, ap_score, save_path):
    plt.figure(figsize=(7, 6))
    plt.plot(recalls, precisions, label=f"PR AUC = {ap_score:.4f}")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall Curve")
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def plot_threshold_sweep(thresholds, f1s, precisions, recalls, save_path):
    plt.figure(figsize=(8, 6))
    plt.plot(thresholds, f1s, label="F1")
    plt.plot(thresholds, precisions, label="Precision", alpha=0.8)
    plt.plot(thresholds, recalls, label="Recall", alpha=0.8)
    plt.xlabel("Threshold")
    plt.ylabel("Score")
    plt.title("Threshold Sweep")
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def calibration_analysis(y_true, y_prob, n_bins=10):
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)

    bins = np.linspace(0.0, 1.0, n_bins + 1)
    bin_ids = np.digitize(y_prob, bins, right=True)

    bin_acc = []
    bin_conf = []
    bin_counts = []

    ece = 0.0
    n = len(y_true)

    for b in range(1, n_bins + 1):
        idx = bin_ids == b
        count = int(idx.sum())

        if count == 0:
            bin_acc.append(0.0)
            bin_conf.append(0.0)
            bin_counts.append(0)
            continue

        acc = float(np.mean(y_true[idx]))
        conf = float(np.mean(y_prob[idx]))
        weight = count / n

        ece += abs(acc - conf) * weight

        bin_acc.append(acc)
        bin_conf.append(conf)
        bin_counts.append(count)

    brier = brier_score_loss(y_true, y_prob)

    return {
        "ece": float(ece),
        "brier_score": float(brier),
        "bin_acc": bin_acc,
        "bin_conf": bin_conf,
        "bin_counts": bin_counts,
        "bins": bins.tolist(),
    }


def plot_calibration(calib, save_path):
    bin_acc = calib["bin_acc"]
    bin_conf = calib["bin_conf"]
    bin_counts = calib["bin_counts"]

    x = np.arange(len(bin_acc))
    width = 0.35

    plt.figure(figsize=(8, 6))
    plt.bar(x - width / 2, bin_acc, width=width, label="Empirical Accuracy")
    plt.bar(x + width / 2, bin_conf, width=width, label="Mean Confidence")
    plt.plot([0, len(bin_acc) - 1], [0, 1], linestyle="--", color="gray", label="Ideal")
    plt.xticks(x, [f"B{i+1}" for i in x], rotation=0)
    plt.xlabel("Confidence Bin")
    plt.ylabel("Value")
    plt.title("Calibration / Reliability Diagram")
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def find_best_threshold(y_true, y_prob):
    thresholds = np.arange(0.05, 0.951, 0.01)
    rows = []

    best_thr = 0.5
    best_f1 = -1.0

    for thr in thresholds:
        y_pred = (y_prob >= thr).astype(int)

        p = precision_score(y_true, y_pred, zero_division=0)
        r = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        acc = accuracy_score(y_true, y_pred)

        rows.append((thr, p, r, f1, acc))

        if f1 > best_f1:
            best_f1 = f1
            best_thr = float(thr)

    return best_thr, best_f1, rows


def evaluate_at_threshold(y_true, y_prob, threshold):
    y_pred = (y_prob >= threshold).astype(int)

    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "classification_report": classification_report(
            y_true,
            y_pred,
            target_names=LABEL_NAMES,
            zero_division=0,
            output_dict=True,
        ),
    }


def main():
    ensure_dir(RESULTS_DIR)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Using device:", device)

    print("🔄 Loading processor...")
    processor = Wav2Vec2FeatureExtractor.from_pretrained(str(MODEL_DIR))

    print("🧠 Loading trained model...")
    model = Wav2Vec2ForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.to(device)  #type: ignore
    model.eval()    #type: ignore

    print("📦 Loading test dataset...")
    test_dataset = Wav2VecAudioDataset(
        root_dir=str(DATA_ROOT / "test"),
        processor=processor,
        sample_rate=SAMPLE_RATE,
        max_duration=MAX_DURATION,
        augment=False,
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=torch.cuda.is_available(),
        drop_last=False,
        collate_fn=collate_fn,
    )

    y_true = []
    y_prob = []
    y_pred_05 = []

    print("🚀 Running inference on TEST set...")

    with torch.no_grad():
        for batch in test_loader:
            input_values = batch["input_values"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(input_values=input_values)  #type: ignore
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)[:, 1]  # fake probability
            preds = (probs >= 0.5).long()

            y_true.extend(labels.cpu().numpy())
            y_prob.extend(probs.cpu().numpy())
            y_pred_05.extend(preds.cpu().numpy())

    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)
    y_pred_05 = np.asarray(y_pred_05)

    print(f"\nTest samples: {len(y_true)}")
    print(f"REAL count: {(y_true == 0).sum()}")
    print(f"FAKE count: {(y_true == 1).sum()}")

    # =========================
    # BASIC METRICS AT 0.5
    # =========================
    metrics_05 = evaluate_at_threshold(y_true, y_prob, 0.5)

    roc_auc = roc_auc_score(y_true, y_prob)
    pr_auc = average_precision_score(y_true, y_prob)

    print("\n=== Metrics @ threshold 0.50 ===")
    print(f"Accuracy : {metrics_05['accuracy']:.4f}")
    print(f"Precision: {metrics_05['precision']:.4f}")
    print(f"Recall   : {metrics_05['recall']:.4f}")
    print(f"F1       : {metrics_05['f1']:.4f}")
    print(f"ROC AUC  : {roc_auc:.4f}")
    print(f"PR AUC   : {pr_auc:.4f}")

    print("\nClassification Report @ 0.50")
    print(classification_report(
        y_true,
        y_pred_05,
        target_names=LABEL_NAMES,
        zero_division=0
    ))

    # =========================
    # THRESHOLD SWEEP
    # =========================
    best_thr, best_f1, sweep_rows = find_best_threshold(y_true, y_prob)
    metrics_best = evaluate_at_threshold(y_true, y_prob, best_thr)

    print("\n=== Threshold Sweep ===")
    print(f"Best threshold: {best_thr:.2f}")
    print(f"Best F1       : {best_f1:.4f}")

    # =========================
    # CONFUSION MATRICES
    # =========================
    cm_05 = np.array(metrics_05["confusion_matrix"])
    cm_best = np.array(metrics_best["confusion_matrix"])

    plot_confusion_matrix(
        cm_05,
        "Confusion Matrix @ Threshold 0.50",
        RESULTS_DIR / "confusion_matrix_0p50.png",
    )

    plot_confusion_matrix(
        cm_best,
        f"Confusion Matrix @ Threshold {best_thr:.2f}",
        RESULTS_DIR / "confusion_matrix_best.png",
    )

    # =========================
    # ROC / PR CURVES
    # =========================
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    plot_roc_curve(fpr, tpr, roc_auc, RESULTS_DIR / "roc_curve.png")

    precisions, recalls, _ = precision_recall_curve(y_true, y_prob)
    plot_pr_curve(recalls, precisions, pr_auc, RESULTS_DIR / "pr_curve.png")

    # =========================
    # THRESHOLD PLOT
    # =========================
    thresholds = [r[0] for r in sweep_rows]
    precisions_s = [r[1] for r in sweep_rows]
    recalls_s = [r[2] for r in sweep_rows]
    f1s_s = [r[3] for r in sweep_rows]

    plot_threshold_sweep(
        thresholds,
        f1s_s,
        precisions_s,
        recalls_s,
        RESULTS_DIR / "threshold_sweep.png",
    )

    # =========================
    # CALIBRATION ANALYSIS
    # =========================
    calib = calibration_analysis(y_true, y_prob, n_bins=10)
    plot_calibration(calib, RESULTS_DIR / "calibration_curve.png")

    print("\n=== Calibration Analysis ===")
    print(f"ECE          : {calib['ece']:.4f}")
    print(f"Brier Score  : {calib['brier_score']:.4f}")

    # =========================
    # SAVE REPORT
    # =========================
    report = {
        "model_dir": str(MODEL_DIR),
        "test_samples": int(len(y_true)),
        "real_count": int((y_true == 0).sum()),
        "fake_count": int((y_true == 1).sum()),
        "metrics_at_0.50": {
            "accuracy": float(metrics_05["accuracy"]),
            "precision": float(metrics_05["precision"]),
            "recall": float(metrics_05["recall"]),
            "f1": float(metrics_05["f1"]),
            "roc_auc": float(roc_auc),
            "pr_auc": float(pr_auc),
            "confusion_matrix": metrics_05["confusion_matrix"],
        },
        "best_threshold": float(best_thr),
        "best_threshold_f1": float(best_f1),
        "metrics_at_best_threshold": {
            "accuracy": float(metrics_best["accuracy"]),
            "precision": float(metrics_best["precision"]),
            "recall": float(metrics_best["recall"]),
            "f1": float(metrics_best["f1"]),
            "confusion_matrix": metrics_best["confusion_matrix"],
        },
        "calibration": {
            "ece": float(calib["ece"]),
            "brier_score": float(calib["brier_score"]),
        },
        "files": {
            "confusion_matrix_0p50": "confusion_matrix_0p50.png",
            "confusion_matrix_best": "confusion_matrix_best.png",
            "roc_curve": "roc_curve.png",
            "pr_curve": "pr_curve.png",
            "threshold_sweep": "threshold_sweep.png",
            "calibration_curve": "calibration_curve.png",
        },
    }

    with open(RESULTS_DIR / "wav2vec2_test_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n✅ Saved evaluation outputs to:")
    print(RESULTS_DIR)
    print("✅ Test report: wav2vec2_test_report.json")
    print("✅ Done.")


if __name__ == "__main__":
    main()