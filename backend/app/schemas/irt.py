from enum import Enum

from pydantic import BaseModel


class ModelType(str, Enum):
    ONE_PL = "1PL"
    TWO_PL = "2PL"
    THREE_PL = "3PL"
    RSM = "RSM"  # Rating Scale Model (polytomous)
    PCM = "PCM"  # Partial Credit Model (polytomous)


class CompetencyLevel(str, Enum):
    RESEARCHER = "researcher"
    EDUCATOR = "educator"
    STUDENT = "student"


class ItemParameter(BaseModel):
    name: str
    difficulty: float
    discrimination: float = 1.0
    guessing: float = 0.0
    se_difficulty: float | None = None
    se_discrimination: float | None = None
    se_guessing: float | None = None


class PolytomousItemParameter(BaseModel):
    """Item parameters for polytomous IRT models (RSM/PCM)."""
    name: str
    difficulty: float  # Item location/difficulty
    thresholds: list[float]  # Andrich threshold parameters (k-1 for k categories)
    se_difficulty: float | None = None
    se_thresholds: list[float] | None = None
    infit_mnsq: float | None = None  # Mean-square infit statistic
    outfit_mnsq: float | None = None  # Mean-square outfit statistic
    infit_zstd: float | None = None  # Standardized infit
    outfit_zstd: float | None = None  # Standardized outfit


class CategoryStructure(BaseModel):
    """Category-level statistics for polytomous items."""
    category: int
    count: int
    observed_average: float
    andrich_threshold: float | None = None
    se_threshold: float | None = None


class AbilityEstimate(BaseModel):
    person_id: str
    theta: float
    se_theta: float | None = None


class ModelFitStatistics(BaseModel):
    log_likelihood: float | None = None
    aic: float | None = None
    bic: float | None = None
    n_parameters: int | None = None
    n_items: int | None = None
    n_persons: int | None = None


class ICCDataPoint(BaseModel):
    theta: float
    probability: float


class ICCCurve(BaseModel):
    item_name: str
    data: list[ICCDataPoint]


class InformationDataPoint(BaseModel):
    theta: float
    information: float


class ItemInformationFunction(BaseModel):
    item_name: str
    data: list[InformationDataPoint]


class TestInformationFunction(BaseModel):
    data: list[InformationDataPoint]


# Polytomous model visualization schemas
class CategoryProbabilityDataPoint(BaseModel):
    """Single point on a category probability curve."""
    theta: float
    probability: float


class CategoryProbabilityCurve(BaseModel):
    """Category probability curve for one item and one category."""
    item_name: str
    category: int
    data: list[CategoryProbabilityDataPoint]


class WrightMapPerson(BaseModel):
    """Person location for Wright map."""
    theta: float
    count: int


class WrightMapItem(BaseModel):
    """Item location with thresholds for Wright map."""
    name: str
    difficulty: float
    thresholds: list[float]


class WrightMapData(BaseModel):
    """Complete data for Wright map visualization."""
    persons: list[WrightMapPerson]
    items: list[WrightMapItem]
    min_logit: float
    max_logit: float


class FitStatisticsItem(BaseModel):
    """Fit statistics for a single item."""
    name: str
    count: int
    measure: float  # Item difficulty
    se: float | None = None
    infit_mnsq: float
    infit_zstd: float | None = None
    outfit_mnsq: float
    outfit_zstd: float | None = None
