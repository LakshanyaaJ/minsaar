import pytest

from application.occupancy import OccupancyEstimator


def test_rolling_median_reduces_single_spike():
    estimator = OccupancyEstimator(window_size=5)
    records = estimator.process([10, 10, 20, 10, 10, 6])
    assert [record.occupancy_estimate for record in records] == [10, 10, 10, 10, 10, 10]


def test_one_zero_does_not_declare_empty():
    estimator = OccupancyEstimator()
    estimator.update(8, 0)
    record = estimator.update(0, 1)
    assert record.is_empty is False
    assert record.occupancy_status == "possibly_empty"


def test_consecutive_zeros_eventually_declare_empty():
    estimator = OccupancyEstimator()
    records = estimator.process([5, 0, 0, 0, 0, 0])
    assert [record.occupancy_status for record in records[1:5]] == [
        "possibly_empty", "possibly_empty", "possibly_empty", "possibly_empty"
    ]
    record = records[-1]
    assert record.is_empty is True
    assert record.occupancy_estimate == 0
    assert record.occupancy_status == "empty"


def test_people_reappearing_returns_to_occupied():
    estimator = OccupancyEstimator()
    estimator.process([0, 0, 0, 0, 0])
    record = estimator.update(4, 2)
    assert record.is_empty is False
    assert record.occupancy_status == "occupied"


def test_reset_clears_window_and_empty_confirmation_state():
    estimator = OccupancyEstimator()
    estimator.process([0, 0, 0, 0, 0])
    estimator.reset()

    record = estimator.update(7, 0)
    assert record.occupancy_estimate == 7
    assert record.detected_count == 7
    assert record.occupancy_status == "occupied"
    assert record.is_empty is False


def test_empty_input_is_valid_and_mismatched_timestamps_are_invalid():
    estimator = OccupancyEstimator()
    assert estimator.process([]) == []
    with pytest.raises(ValueError):
        estimator.process([1], [])


@pytest.mark.parametrize("count", [-1, 1.5, True, "2"])
def test_invalid_counts_are_rejected(count):
    with pytest.raises(ValueError):
        OccupancyEstimator().update(count, 0)


@pytest.mark.parametrize(
    "window,zeros", [(0, 1), (-1, 1), (1, 0), (1, -2)]
)
def test_invalid_configuration(window, zeros):
    with pytest.raises(ValueError):
        OccupancyEstimator(window, zeros)
