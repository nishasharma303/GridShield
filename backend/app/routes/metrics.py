from fastapi import APIRouter, HTTPException
from app.model_loader import load_metrics

router = APIRouter()


def pick_col(df, candidates):
    for col in candidates:
        if col in df.columns:
            return col
    raise ValueError(f"None of these columns found: {candidates}. Available columns: {list(df.columns)}")


@router.get("/metrics")
def get_metrics():
    try:
        df = load_metrics()

        if df.empty:
            raise ValueError("Metrics CSV is empty")

        model_col = df.columns[0]
        precision_col = pick_col(df, ["Precision", "precision"])
        recall_col = pick_col(df, ["Recall", "recall"])
        f1_col = pick_col(df, ["F1", "f1"])
        roc_auc_col = pick_col(df, ["ROC-AUC", "roc_auc", "ROC AUC"])
        pr_auc_col = pick_col(df, ["PR-AUC", "pr_auc", "PR AUC"])

        best_row = df.sort_values(f1_col, ascending=False).iloc[0]

        return {
            "best_model": str(best_row[model_col]),
            "precision": round(float(best_row[precision_col]), 4),
            "recall": round(float(best_row[recall_col]), 4),
            "f1": round(float(best_row[f1_col]), 4),
            "roc_auc": round(float(best_row[roc_auc_col]), 4),
            "pr_auc": round(float(best_row[pr_auc_col]), 4),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))