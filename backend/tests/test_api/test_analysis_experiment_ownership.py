import uuid
from unittest.mock import MagicMock

import pytest

from app.api.v1.analysis import ensure_experiment_ownership
from app.models.experiment import Experiment
from app.models.project import Project


def _make_project(owner_user_id=None, owner_organization_id=None):
    project = Project()
    project.id = uuid.uuid4()
    project.name = "Test Project"
    project.owner_user_id = owner_user_id
    project.owner_organization_id = owner_organization_id
    return project


def _make_session(existing_experiment=None):
    session = MagicMock()
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none.return_value = existing_experiment
    session.execute.return_value = scalar_result
    session.add = MagicMock()
    session.commit = MagicMock()
    session.refresh = MagicMock()
    return session


def test_inserts_user_owned_experiment_when_absent():
    user_id = uuid.uuid4()
    project = _make_project(owner_user_id=user_id)
    session = _make_session(existing_experiment=None)

    result = ensure_experiment_ownership(
        session,
        mlflow_experiment_id="42",
        name=project.name,
        project=project,
    )

    assert isinstance(result, Experiment)
    assert result.mlflow_experiment_id == "42"
    assert result.owner_user_id == user_id
    assert result.owner_organization_id is None
    assert session.add.call_count == 1
    assert session.commit.call_count == 1


def test_inserts_organization_owned_experiment_when_absent():
    org_id = uuid.uuid4()
    project = _make_project(owner_organization_id=org_id)
    session = _make_session(existing_experiment=None)

    result = ensure_experiment_ownership(
        session,
        mlflow_experiment_id="99",
        name=project.name,
        project=project,
    )

    assert result.owner_user_id is None
    assert result.owner_organization_id == org_id
    assert session.add.call_count == 1
    assert session.commit.call_count == 1


def test_idempotent_when_experiment_exists():
    user_id = uuid.uuid4()
    project = _make_project(owner_user_id=user_id)

    existing = Experiment(
        id=uuid.uuid4(),
        mlflow_experiment_id="42",
        name=project.name,
        owner_user_id=user_id,
    )
    session = _make_session(existing_experiment=existing)

    result = ensure_experiment_ownership(
        session,
        mlflow_experiment_id="42",
        name=project.name,
        project=project,
    )

    assert result is existing
    assert session.add.call_count == 0
    assert session.commit.call_count == 0


def test_second_call_with_same_mlflow_id_does_not_insert_duplicate():
    user_id = uuid.uuid4()
    project = _make_project(owner_user_id=user_id)
    session = _make_session(existing_experiment=None)

    first = ensure_experiment_ownership(
        session,
        mlflow_experiment_id="100",
        name=project.name,
        project=project,
    )

    session_second = _make_session(existing_experiment=first)

    second = ensure_experiment_ownership(
        session_second,
        mlflow_experiment_id="100",
        name=project.name,
        project=project,
    )

    assert second is first
    assert session_second.add.call_count == 0
    assert session_second.commit.call_count == 0


def test_select_query_filters_by_mlflow_experiment_id():
    project = _make_project(owner_user_id=uuid.uuid4())
    session = _make_session(existing_experiment=None)

    ensure_experiment_ownership(
        session,
        mlflow_experiment_id="abc-123",
        name=project.name,
        project=project,
    )

    assert session.execute.call_count == 1
    statement = session.execute.call_args[0][0]
    compiled = str(statement.compile(compile_kwargs={"literal_binds": True}))
    assert "experiments" in compiled
    assert "abc-123" in compiled
