import logging

from python.utils.logger_internal import get_logger, log_warning


def test_pack_logs_reach_comfy_root_handlers(caplog):
	caplog.set_level(logging.INFO)

	log_warning("routed message", module = "Routing")

	messages = [r.getMessage() for r in caplog.records if r.name == "TojiooPassthrough.Routing"]
	assert messages == ["[Tojioo Passthrough] routed message"]
	assert "\033" not in caplog.text


def test_pack_logger_follows_root_level(caplog):
	caplog.set_level(logging.INFO)
	logger = get_logger("python.nodes.routing_level")

	assert logger.handlers == []
	assert not logger.isEnabledFor(logging.DEBUG)
	assert logger.isEnabledFor(logging.INFO)


def test_prefix_is_added_once_per_record(caplog):
	caplog.set_level(logging.INFO)
	logger = get_logger("python.nodes.routing_once")
	get_logger("python.nodes.routing_once")

	logger.info("value=%s", 5)

	assert [r.getMessage() for r in caplog.records] == ["[Tojioo Passthrough] value=5"]
