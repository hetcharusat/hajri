"""
Supabase JWT authentication for HAJRI Engine.
Validates Bearer tokens from mobile app.
Supports dev_mode for testing without real JWT.
"""

from typing import Optional
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from app.config import get_settings


security = HTTPBearer(auto_error=False)  # Don't auto-error, we handle it
optional_security = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    """Authenticated user from JWT."""
    user_id: str
    email: Optional[str] = None
    student_id: Optional[str] = None
    is_admin: bool = False


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> AuthenticatedUser:
    """
    Validate Supabase JWT and extract user info.
    In dev_mode, accepts test tokens and uses X-Student-ID header.
    
    Raises:
        HTTPException: If token is invalid or expired.
    """
    settings = get_settings()
    
    # Dev mode: accept test tokens
    if settings.dev_mode:
        if credentials and credentials.credentials.startswith("test-token-"):
            # Extract test user ID from token
            test_user_id = credentials.credentials.replace("test-token-", "")
            # Use X-Student-ID header for student_id in dev mode
            student_id = request.headers.get("X-Student-ID", "test-student-001")
            return AuthenticatedUser(
                user_id=test_user_id,
                email="test@example.com",
                student_id=student_id,
                is_admin=True  # Allow all operations in dev mode
            )
    
    # No credentials provided
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = credentials.credentials
    
    try:
        # Decode JWT using Supabase JWT secret
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")
        
        # Extract user metadata
        user_metadata = payload.get("user_metadata", {})
        app_metadata = payload.get("app_metadata", {})
        
        return AuthenticatedUser(
            user_id=user_id,
            email=payload.get("email"),
            student_id=user_metadata.get("student_id"),
            is_admin=app_metadata.get("is_admin", False)
        )
        
    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token: {str(e)}"
        )


async def get_current_student(
    user: AuthenticatedUser = Depends(get_current_user)
) -> AuthenticatedUser:
    """
    Get current user and verify they have a student_id.
    
    Raises:
        HTTPException: If user is not linked to a student.
    """
    if not user.student_id:
        raise HTTPException(
            status_code=403,
            detail="Account not linked to a student profile. Please complete setup."
        )
    return user


class OptionalAuth:
    """
    Optional authentication - returns None if no token provided.
    Useful for endpoints that work differently for authenticated vs anonymous users.
    """
    
    async def __call__(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security)
    ) -> Optional[AuthenticatedUser]:
        if not credentials:
            return None
        
        try:
            return await get_current_user(credentials)
        except HTTPException:
            return None
