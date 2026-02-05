import logging


class TestLogger:

	def test_get_logger_returns_logger(self):
		from python.utils.logger import get_logger

		logger = get_logger("test_module")
		assert isinstance(logger, logging.Logger)


	def test_logger_has_name(self):
		from python.utils.logger import get_logger

		logger = get_logger("test.module.name")
		assert logger.name == "TojiooPassthrough.name"


	def test_logger_has_handler(self):
		from python.utils.logger import get_logger

		logger = get_logger("test_handler")
		assert len(logger.handlers) > 0


	def test_logger_level_set(self):
		from python.utils.logger import get_logger

		logger = get_logger("test_level")
		assert logger.level == logging.DEBUG