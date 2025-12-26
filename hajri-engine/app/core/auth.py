"""
Supabase JWT authentication for HAJRI Engine.
Validates Bearer tokens from mobile app.
"""

from typing import Optional
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from app.config import get_settings


security = HTTPBearer()


class AuthenticatedUser(BaseModel):
    """Authenticated user from JWT."""
    user_id: str
    email: Optional[str] = None
    student_id: Optional[str] = None
    is_admin: bool = False


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> AuthenticatedUser:
    """
    Validate Supabase JWT and extract user info.
    
    Raises:
        HTTPException: If token is invalid or expired.
    """
    settings = get_settings()
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
        credentials: Optional[HTTPAuthorizationCredentials] = Security(security, auto_error=False)
    ) -> Optional[AuthenticatedUser]:
        if not credentials:
            return None
        
        try:
            return await get_current_user(credentials)
        except HTTPException:
            return None
