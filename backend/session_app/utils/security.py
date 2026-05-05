import bcrypt

# Hashes a plain-text password using bcrypt with a randomly generated salt.
# Returns the hashed password as a UTF-8 string for storage.
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# Verifies a plain-text password against a stored bcrypt hash.
# Returns True if they match, False otherwise.
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
