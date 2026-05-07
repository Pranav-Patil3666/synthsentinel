import os
import torch
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_curve,
    roc_auc_score,
    precision_recall_curve,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    accuracy_score,
)

from torch.utils.data import DataLoader

from dataset import AudioDataset
from model import CNNModel


 
# CONFIG
 
BASE = r"D:\ml-project\Audio Forensics for Voice Security\ml"

MODEL_PATH = os.path.join(BASE, "models", "cnn_best.pth")

BATCH_SIZE = 32
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


 
# LOAD DATA
 
print("📦 Loading test dataset...")

test_dataset = AudioDataset(
    os.path.join(BASE, "data", "final", "test")
)

test_loader = DataLoader(
    test_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=4,
    pin_memory=True,
    drop_last=False
)


 
# LOAD MODEL
 
print("🧠 Loading model...")

model = CNNModel().to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()


 
# INFERENCE
 
all_probs = []
all_preds = []
all_labels = []

print("🚀 Running evaluation...")

with torch.no_grad():
    for x, y in test_loader:

        x = x.to(DEVICE)
        y = y.to(DEVICE)

        outputs = model(x)

        probs = torch.softmax(outputs, dim=1)[:, 1]

        preds = (probs >= 0.5).long()

        all_probs.extend(probs.cpu().numpy())
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(y.cpu().numpy())


all_probs = np.array(all_probs)
all_preds = np.array(all_preds)
all_labels = np.array(all_labels)


 
# BASIC METRICS
 
accuracy = accuracy_score(all_labels, all_preds)
precision = precision_score(all_labels, all_preds)
recall = recall_score(all_labels, all_preds)
f1 = f1_score(all_labels, all_preds)
auc = roc_auc_score(all_labels, all_probs)
ap = average_precision_score(all_labels, all_probs)

print("\n📊 RESULTS")
print(f"Accuracy  : {accuracy:.4f}")
print(f"Precision : {precision:.4f}")
print(f"Recall    : {recall:.4f}")
print(f"F1 Score  : {f1:.4f}")
print(f"ROC AUC   : {auc:.4f}")
print(f"PR AUC    : {ap:.4f}")

print("\n📄 Classification Report")
print(classification_report(all_labels, all_preds))


 
# CONFUSION MATRIX
 
cm = confusion_matrix(all_labels, all_preds)

plt.figure(figsize=(6, 5))
sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    cmap="Blues",
    xticklabels=["REAL", "FAKE"],
    yticklabels=["REAL", "FAKE"]
)

plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.title("Confusion Matrix")

cm_path = os.path.join(BASE, "results", "confusion_matrix.png")
os.makedirs(os.path.dirname(cm_path), exist_ok=True)

plt.savefig(cm_path, bbox_inches="tight")
plt.close()

print(f"✅ Saved confusion matrix → {cm_path}")


 
# ROC CURVE
 
fpr, tpr, thresholds = roc_curve(all_labels, all_probs)

plt.figure(figsize=(7, 6))
plt.plot(fpr, tpr, label=f"AUC = {auc:.4f}")
plt.plot([0, 1], [0, 1], linestyle="--")

plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC Curve")
plt.legend()

roc_path = os.path.join(BASE, "results", "roc_curve.png")

plt.savefig(roc_path, bbox_inches="tight")
plt.close()

print(f"✅ Saved ROC curve → {roc_path}")


 
# PRECISION-RECALL CURVE
 
precisions, recalls, pr_thresholds = precision_recall_curve(
    all_labels,
    all_probs
)

plt.figure(figsize=(7, 6))
plt.plot(recalls, precisions)

plt.xlabel("Recall")
plt.ylabel("Precision")
plt.title("Precision-Recall Curve")

pr_path = os.path.join(BASE, "results", "pr_curve.png")

plt.savefig(pr_path, bbox_inches="tight")
plt.close()

print(f"✅ Saved PR curve → {pr_path}")


 
# THRESHOLD ANALYSIS
 
print("\n🎯 Threshold Analysis")

best_threshold = 0.5
best_f1 = 0.0

for threshold in np.arange(0.1, 0.91, 0.05):

    preds = (all_probs >= threshold).astype(int)

    current_f1 = f1_score(all_labels, preds)

    print(f"Threshold={threshold:.2f} | F1={current_f1:.4f}")

    if current_f1 > best_f1:
        best_f1 = current_f1
        best_threshold = threshold

print("\n🏆 Best Threshold")
print(f"Threshold: {best_threshold:.2f}")
print(f"Best F1  : {best_f1:.4f}")

print("\n✅ Evaluation Complete")