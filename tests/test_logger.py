import logging

from python.utils.logger_internal import get_logger, log_debug, log_error, log_info, log_warning


def test_get_logger_returns_logger():
	logger = get_logger("test_module")
	assert isinstance(logger, logging.Logger)


def test_get_logger_uses_leaf_module_name():
	logger = get_logger("test.module.name")
	assert logger.name == "TojiooPassthrough.name"


def test_get_logger_is_configured_once():
	logger = get_logger("test_once")
	handler_count = len(logger.handlers)
	logger_again = get_logger("test_once")
	assert logger_again is logger
	assert len(logger_again.handlers) == handler_count


def test_log_helpers_do_not_raise():
	log_info("info message", module = "Test")
	log_warning("warning message", module = "Test")
	log_debug("debug message", module = "Test")
	log_error("error message", module = "Test")