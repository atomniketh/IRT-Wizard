from enum import Enum

from pydantic import BaseModel


class ModelType(str, Enum):
    ONE_PL = "1PL"
    TWO_PL = "2PL"
    THREE_PL = "3PL"


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
