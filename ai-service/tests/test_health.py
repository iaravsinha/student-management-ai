def test_ai_service_imports() -> None:
    """
    Basic health check to ensure the AI service app can be imported
    without path or shadowing issues.
    """
    from app.main import app
    assert app is not None
