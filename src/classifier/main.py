from pathlib import Path
from typing import Annotated
from datasets import load_dataset
from transformers import AutoTokenizer
from transformers import DataCollatorWithPadding
import evaluate
import numpy as np
from transformers import AutoModelForSequenceClassification, TrainingArguments, Trainer, pipeline

import typer

app = typer.Typer()


@app.command()
def train(
    data: Annotated[
        Path,
        typer.Option(
            exists=True,
            file_okay=True,
            dir_okay=False,
            writable=False,
            readable=True,
            resolve_path=True,
        ),
    ],
    labels: Annotated[
        Path,
        typer.Option(
            exists=True,
            file_okay=True,
            dir_okay=False,
            writable=False,
            readable=True,
            resolve_path=True,
        ),
    ],
):

    dataset = load_dataset("csv", data_files=str(data), split="train")
    all_labels = labels.read_text().split("\n")
    classes = [class_ for class_ in all_labels if class_]
    class2id = {class_: id for id, class_ in enumerate(classes)}
    id2class = {id: class_ for class_, id in class2id.items()}

    model_path = "google-bert/bert-base-uncased"
    tokenizer = AutoTokenizer.from_pretrained(model_path)

    def preprocess_function(example):
        labels = [0.0 for i in range(len(classes))]
        text = example["description"]

        if example["labels"] is not None:
            all_labels = example["labels"].split("_")
            for label in all_labels:
                label_id = class2id[label]
                labels[label_id] = 1.0

        example = tokenizer(text, truncation=True)
        example["labels"] = labels
        return example

    tokenized_dataset = dataset.map(preprocess_function, remove_columns=dataset.column_names)
    tokenized_dataset = tokenized_dataset.train_test_split(test_size=0.1)
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
    clf_metrics = evaluate.combine(["accuracy", "f1", "precision", "recall"])

    def sigmoid(x):
        return 1 / (1 + np.exp(-x))

    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        predictions = sigmoid(predictions)
        predictions = (predictions > 0.5).astype(int).reshape(-1)
        return clf_metrics.compute(
            predictions=predictions, references=labels.astype(int).reshape(-1)
        )

    model = AutoModelForSequenceClassification.from_pretrained(
        model_path,
        num_labels=len(classes),
        id2label=id2class,
        label2id=class2id,
        problem_type="multi_label_classification",
        dtype="auto"
    )
    training_args = TrainingArguments(
        output_dir="my_awesome_model",
        learning_rate=2e-5,
        per_device_train_batch_size=3,
        per_device_eval_batch_size=3,
        num_train_epochs=2,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["test"],
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.save_model('model')


@app.command()
def predict():
    print("Predicting")
    pipe = pipeline(model='model', task='text-classification')
    res = pipe('SHENG SHIONG SUPE')
    print(res)


if __name__ == "__main__":
    app()
