import os
import random
import numpy as np
import torch
import librosa
from torch.utils.data import Dataset


class Wav2VecAudioDataset(Dataset):

    def __init__(
        self,
        root_dir,
        processor,
        sample_rate=16000,
        max_duration=4,
        augment=False
    ):
        self.samples = []
        self.processor = processor
        self.sample_rate = sample_rate
        self.max_length = sample_rate * max_duration
        self.augment = augment

        for label, class_name in enumerate(["real", "fake"]):
            class_dir = os.path.join(root_dir, class_name)

            if not os.path.exists(class_dir):
                continue

            for file in os.listdir(class_dir):
                if file.endswith(".wav") or file.endswith(".flac"):
                    path = os.path.join(class_dir, file)
                    if not os.path.isfile(path):
                        continue
                    self.samples.append((path, label))

        print(f"Loaded {len(self.samples)} samples from {root_dir}")

    def __len__(self):
        return len(self.samples)

    def augment_audio(self, y):

        # Gaussian noise
        if random.random() < 0.3:
            noise = np.random.randn(len(y)) * 0.0015
            y = y + noise

        # Gain variation
        if random.random() < 0.3:
            gain = random.uniform(0.9, 1.1)
            y = y * gain

        # Time shift
        if random.random() < 0.3:
            shift = random.randint(0, int(self.sample_rate * 0.2))
            y = np.roll(y, shift)
            y[:shift] = 0.0

        y = np.clip(y, -1.0, 1.0)
        return y

    def __getitem__(self, idx):
        path, label = self.samples[idx]

        
        # LOAD AUDIO
        
        y, sr = librosa.load(path, sr=self.sample_rate, mono=True)

        
        # FIX LENGTH
        
        if len(y) < self.max_length:
            y = np.pad(y, (0, self.max_length - len(y)))
        else:
            if self.augment:
                # random crop window during training
                max_start = len(y) - self.max_length
                start = random.randint(0, max_start)
                y = y[start:start + self.max_length]
            else:
                # deterministic crop for val/test
                y = y[:self.max_length]

        
        # AUGMENTATION
        
        if self.augment:
            y = self.augment_audio(y)

        
        # WAV2VEC PROCESSOR
        
        inputs = self.processor(
            y,
            sampling_rate=self.sample_rate,
            return_tensors="pt",
            padding=False
        )

        input_values = inputs.input_values.squeeze(0)
        label = torch.tensor(label).long()

        return {
            "input_values": input_values,
            "labels": label
        }