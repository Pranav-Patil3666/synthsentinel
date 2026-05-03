import torch
import torch.nn as nn
import torch.optim as optim

from torch.utils.data import DataLoader
import os
from dataset import AudioDataset

from model import CNNModel
from sklearn.metrics import roc_auc_score


def main():
    
    # PATHS
    BASE = r"D:\ml-project\Audio Forensics for Voice Security\ml"

    # DEVICE
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Using device:", device)
    
    # DATA
    train_dataset = AudioDataset(f"{BASE}/data/final/train")
    val_dataset = AudioDataset(f"{BASE}/data/final/val")

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=4, pin_memory=True, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=4, pin_memory=True, drop_last=True)
    
    # MODEL    
    model = CNNModel().to(device)

    # LOSS (IMPROVED)    
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)

    # OPTIMIZER    
    optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)  #type: ignore
     
    # SCHEDULER
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=10)

    # TRAINING    
    EPOCHS = 20
    best_auc = 0.0
    scaler = torch.amp.GradScaler("cuda")  # 🔥 mixed precision  #type: ignore

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0

        for x, y in train_loader:
            x, y = x.to(device), y.to(device)

            optimizer.zero_grad()

            # 🔥 Mixed precision
            with torch.amp.autocast("cuda"):  #type: ignore
                outputs = model(x)
                loss = criterion(outputs, y)

            scaler.scale(loss).backward()

            # 🔥 Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)

            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()

        avg_loss = total_loss / len(train_loader)

        
        # VALIDATION
        model.eval()
        preds = []
        targets = []

        correct = 0
        total = 0

        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)

                outputs = model(x)
                probs = torch.softmax(outputs, dim=1)[:, 1]

                preds.extend(probs.cpu().numpy())
                targets.extend(y.cpu().numpy())

                predicted = torch.argmax(outputs, dim=1)
                correct += (predicted == y).sum().item()
                total += y.size(0)

        accuracy = 100 * correct / total

        try:
            auc = roc_auc_score(targets, preds)
        except:
            auc = 0.0

        
        # SAVE BEST MODEL
        
        if auc > best_auc:
            best_auc = auc
            torch.save(model.state_dict(), os.path.join(BASE, "models", "cnn_best.pth"))

        scheduler.step()

        print(f"Epoch {epoch+1}/{EPOCHS} | Loss: {avg_loss:.4f} | Acc: {accuracy:.2f}% | AUC: {auc:.4f}")

    
    # SAVE FINAL
    
    torch.save(model.state_dict(), os.path.join(BASE, "models", "cnn_last.pth"))

    print(f"✅ Training complete | Best AUC: {best_auc:.4f}")


if __name__ == "__main__":
    main()