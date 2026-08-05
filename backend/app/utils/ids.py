import secrets
import string


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(4)}"


def new_device_token() -> str:
    return f"devtok_{secrets.token_hex(8)}"


def random_pairing_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))
