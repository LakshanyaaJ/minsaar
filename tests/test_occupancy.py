import pytest

from occupancy import OccupancyEstimator


def test_rolling_median_reduces_single_spike():
    estimator = OccupancyEstimator(window_size=5, zero_confirmation_samples=3)
    records = estimator.process([10, 10, 20, 10])
    assert [record.occupancy_estimate for record in records] == [10, 10, 10, 10]


def test_one_zero_does_not_declare_empty():
    estimator = OccupancyEstimator(window_size=3, zero_confirmation_samples=2)
    estimator.update(8, 0)
    record = estimator.update(0, 1)
    assert record.is_empty is False
    assert record.occupancy_status != "empty"


def test_consecutive_zeros_eventually_declare_empty():
    estimator = OccupancyEstimator(window_size=5, zero_confirmation_samples=3)
    estimator.process([5, 0, 0])
    record = estimator.update(0, 3)
    assert record.is_empty is True
    assert record.occupancy_estimate == 0
    assert record.occupancy_status == "empty"


def test_people_reappearing_returns_to_occupied():
    estimator = OccupancyEstimator(window_size=2, zero_confirmation_samples=2)
    estimator.process([0, 0])
    record = estimator.update(4, 2)
    assert record.is_empty is False
    assert record.occupancy_status == "occupied"


def test_empty_input_is_valid_and_mismatched_timestamps_are_invalid():
    estimator = OccupancyEstimator()
    assert estimator.process([]) == []
    with pytest.raises(ValueError):
        estimator.process([1], [])


@pytest.mark.parametrize(
    "window,zeros", [(0, 1), (-1, 1), (1, 0), (1, -2)]
)
def test_invalid_configuration(window, zeros):
    with pytest.raises(ValueError):
        OccupancyEstimator(window, zeros)
