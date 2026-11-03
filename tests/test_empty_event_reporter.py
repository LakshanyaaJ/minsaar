import json
from unittest.mock import Mock

import pytest
import requests

from application.empty_event_reporter import EmptyEventReporter


def make_record(
    status="possibly_empty", confirmed=False, timestamp=12.5, count=0
):
    return {
        "timestamp_seconds": timestamp,
        "detected_count": count,
        "occupancy_estimate": count,
        "occupancy_status": status,
        "empty_confirmation_status": confirmed,
    }


def make_reporter(tmp_path, post):
    return EmptyEventReporter(
        tmp_path / "occupancy_events",
        "https://backend.invalid/api/occupancy",
        timeout_seconds=2.5,
        post=post,
    )


def test_no_event_for_occupied_or_possibly_empty(tmp_path):
    post = Mock()
    reporter = make_reporter(tmp_path, post)

    assert reporter.observe(make_record("occupied", False, count=3), "room_a") is None
    assert reporter.observe(make_record(), "room_a") is None
    assert list((tmp_path / "occupancy_events").rglob("*.json")) == []
    post.assert_not_called()


def test_confirmed_empty_saves_and_posts_once_for_transition(tmp_path):
    post = Mock()
    post.return_value.raise_for_status.return_value = None
    reporter = make_reporter(tmp_path, post)

    event_path = reporter.observe(make_record("empty", True), "classroom_01")
    reporter.observe(make_record("empty", True, timestamp=12.516), "classroom_01")
    reporter.wait_for_idle()

    assert event_path is not None
    assert event_path.exists() is False
    sent_files = list((tmp_path / "occupancy_events" / "sent").glob("*.json"))
    assert len(sent_files) == 1
    payload = json.loads(sent_files[0].read_text(encoding="utf-8"))
    assert payload == {
        "room_id": "classroom_01",
        "timestamp_seconds": 12.5,
        "detected_count": 0,
        "occupancy_estimate": 0,
        "occupancy_status": "empty",
        "empty_confirmation_status": True,
    }
    post.assert_called_once_with(
        "https://backend.invalid/api/occupancy",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=2.5,
    )
    assert any("accepted" in message for message in reporter.get_status_updates())


def test_people_reappearing_allows_a_later_empty_event(tmp_path):
    post = Mock()
    post.return_value.raise_for_status.return_value = None
    reporter = make_reporter(tmp_path, post)

    first = reporter.observe(make_record("empty", True, timestamp=1.0), "room_a")
    reporter.observe(make_record("occupied", False, timestamp=2.0, count=2), "room_a")
    second = reporter.observe(make_record("empty", True, timestamp=3.0), "room_a")
    reporter.wait_for_idle()

    assert first != second
    assert len(list((tmp_path / "occupancy_events" / "sent").glob("*.json"))) == 2
    assert post.call_count == 2


def test_identical_event_is_not_posted_again_after_app_restart(tmp_path):
    post = Mock()
    post.return_value.raise_for_status.return_value = None
    record = make_record("empty", True, timestamp=5.0)
    first_reporter = make_reporter(tmp_path, post)
    first_reporter.observe(record, "room_a")
    first_reporter.wait_for_idle()

    second_reporter = make_reporter(tmp_path, post)
    duplicate_path = second_reporter.observe(record, "room_a")
    second_reporter.wait_for_idle()

    assert duplicate_path is not None
    assert duplicate_path.parent.name == "sent"
    post.assert_called_once()


def test_failed_post_keeps_local_json_and_can_be_retried(tmp_path):
    post = Mock()
    successful_response = Mock()
    successful_response.raise_for_status.return_value = None
    post.side_effect = [requests.ConnectionError("offline"), successful_response]
    reporter = make_reporter(tmp_path, post)

    pending_path = reporter.observe(make_record("empty", True), "room_a")
    reporter.wait_for_idle()

    assert pending_path is not None and pending_path.exists()
    assert json.loads(pending_path.read_text(encoding="utf-8"))["room_id"] == "room_a"
    assert any("connection failed" in item for item in reporter.get_status_updates())

    assert reporter.retry_pending() == 1
    reporter.wait_for_idle()
    assert pending_path.exists() is False
    assert len(list((tmp_path / "occupancy_events" / "sent").glob("*.json"))) == 1


@pytest.mark.parametrize(
    ("error", "status_text"),
    [
        (requests.Timeout("slow"), "timed out"),
        (requests.ConnectionError("offline"), "connection failed"),
    ],
)
def test_network_errors_are_reported_and_event_is_retained(
    tmp_path, error, status_text
):
    post = Mock(side_effect=error)
    reporter = make_reporter(tmp_path, post)

    event_path = reporter.observe(make_record("empty", True), "room_a")
    reporter.wait_for_idle()

    assert event_path is not None and event_path.exists()
    assert any(status_text in item for item in reporter.get_status_updates())


def test_failed_http_response_is_retained(tmp_path):
    response = Mock()
    response.raise_for_status.side_effect = requests.HTTPError("500")
    reporter = make_reporter(tmp_path, Mock(return_value=response))

    event_path = reporter.observe(make_record("empty", True), "room_a")
    reporter.wait_for_idle()

    assert event_path is not None and event_path.exists()
    assert any("remains pending" in item for item in reporter.get_status_updates())