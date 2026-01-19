import pytest
import numpy as np


@pytest.fixture
def sample_response_data():
    np.random.seed(42)
    n_persons = 100
    n_items = 10

    true_theta = np.random.normal(0, 1, n_persons)
    true_difficulty = np.random.normal(0, 1, n_items)

    data = np.zeros((n_persons, n_items))
    for i in range(n_persons):
        for j in range(n_items):
            prob = 1 / (1 + np.exp(-(true_theta[i] - true_difficulty[j])))
            data[i, j] = 1 if np.random.random() < prob else 0

    return data


@pytest.fixture
def item_names():
    return [f"Item_{i+1}" for i in range(10)]
