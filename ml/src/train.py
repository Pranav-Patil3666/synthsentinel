import os
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np


from torch.utils.data import (
    DataLoader,
    WeightedRandomSampler
)

from sklearn.metrics import roc_auc_score

from dataset import AudioDataset
from model import CNNModel


def main():

    # =========================
    # PATHS
    # =========================
    BASE = r"D:\ml-project\Audio Forensics for Voice Security\ml"

    # =========================
    # DEVICE
    # =========================
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Using device:", device)

    # =========================
    # DATASETS
    # =========================
    train_dataset = AudioDataset(
        f"{BASE}/data/final/train"
    )

    val_dataset = AudioDataset(
        f"{BASE}/data/final/val"
    )

    # =========================
    # WEIGHTED SAMPLER
    # =========================
    print("📊 Computing balanced sampling weights...")

    labels = [sample[1] for sample in train_dataset.samples]

    class_counts = np.bincount(labels)

    print("Class counts:", class_counts)

    # principled inverse-frequency weighting
    class_weights = len(labels) / class_counts

    sample_weights = [
        class_weights[label]
        for label in labels
    ]

    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True
    )

    # =========================
    # DATALOADERS
    # =========================
    train_loader = DataLoader(
        train_dataset,
        batch_size=32,
        sampler=sampler,
        num_workers=4,
        pin_memory=True,
        drop_last=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=32,
        shuffle=False,
        num_workers=4,
        pin_memory=True,
        drop_last=False
    )

    # =========================
    # MODEL
    # =========================
    model = CNNModel().to(device)

    # =========================
    # LOSS
    # =========================
    criterion = nn.CrossEntropyLoss(
        label_smoothing=0.05
    )

    # =========================
    # OPTIMIZER
    # =========================
    optimizer = optim.AdamW(     # type: ignore
        model.parameters(),
        lr=1e-3,
        weight_decay=1e-4
    )

    # =========================
    # SCHEDULER
    # =========================
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=10
    )

    # =========================
    # TRAINING CONFIG
    # =========================
    EPOCHS = 20
    best_auc = 0.0

    scaler = torch.amp.GradScaler("cuda")    # type: ignore

    # =========================
    # TRAIN LOOP
    # =========================
    for epoch in range(EPOCHS):

        model.train()

        total_loss = 0.0

        for x, y in train_loader:

            x = x.to(device)
            y = y.to(device)

            optimizer.zero_grad()

            # =====================
            # MIXED PRECISION
            # =====================
            with torch.amp.autocast("cuda"):     # type: ignore

                outputs = model(x)

                loss = criterion(outputs, y)

            # =====================
            # BACKPROP
            # =====================
            scaler.scale(loss).backward()

            # gradient clipping
            torch.nn.utils.clip_grad_norm_(
                model.parameters(),
                1.0
            )

            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()

        avg_loss = total_loss / len(train_loader)

        # =========================
        # VALIDATION
        # =========================
        model.eval()

        preds = []
        targets = []

        correct = 0
        total = 0

        with torch.no_grad():

            for x, y in val_loader:

                x = x.to(device)
                y = y.to(device)

                outputs = model(x)

                probs = torch.softmax(
                    outputs,
                    dim=1
                )[:, 1]

                preds.extend(
                    probs.cpu().numpy()
                )

                targets.extend(
                    y.cpu().numpy()
                )

                predicted = torch.argmax(
                    outputs,
                    dim=1
                )

                correct += (
                    predicted == y
                ).sum().item()

                total += y.size(0)

        accuracy = 100 * correct / total

        try:
            auc = roc_auc_score(
                targets,
                preds
            )
        except Exception:
            auc = 0.0

        # =========================
        # SAVE BEST
        # =========================
        if auc > best_auc:

            best_auc = auc

            torch.save(
                model.state_dict(),
                os.path.join(
                    BASE,
                    "models",
                    "cnn_best.pth"
                )
            )

        scheduler.step()

        print(
            f"Epoch {epoch+1}/{EPOCHS} "
            f"| Loss: {avg_loss:.4f} "
            f"| Acc: {accuracy:.2f}% "
            f"| AUC: {auc:.4f}"
        )

    # =========================
    # SAVE FINAL
    # =========================
    torch.save(
        model.state_dict(),
        os.path.join(
            BASE,
            "models",
            "cnn_last.pth"
        )
    )

    print(
        f"\n✅ Training complete "
        f"| Best AUC: {best_auc:.4f}"
    )


if __name__ == "__main__":
    main()