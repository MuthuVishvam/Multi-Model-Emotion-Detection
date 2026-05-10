"""
Power BI Integration API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
import json
import requests
from base64 import b64encode

from app.core.config import settings
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()

# Power BI Service Principal Credentials
POWER_BI_CONFIG = {
    "tenant_id": settings.POWERBI_TENANT_ID,
    "client_id": settings.POWERBI_CLIENT_ID,
    "client_secret": settings.POWERBI_CLIENT_SECRET,
    "group_id": settings.POWERBI_GROUP_ID,
    "app_workspace_id": settings.POWERBI_WORKSPACE_ID
}


async def get_powerbi_access_token():
    """Get Power BI service principal access token"""
    try:
        url = f"https://login.microsoftonline.com/{POWER_BI_CONFIG['tenant_id']}/oauth2/v2.0/token"
        
        payload = {
            "grant_type": "client_credentials",
            "client_id": POWER_BI_CONFIG["client_id"],
            "client_secret": POWER_BI_CONFIG["client_secret"],
            "scope": "https://analysis.windows.net/.default"
        }
        
        response = requests.post(url, data=payload)
        
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            raise HTTPException(status_code=400, detail="Failed to get Power BI token")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Power BI authentication failed: {str(e)}")


@router.get("/reports", tags=["Power BI"])
async def get_powerbi_reports(current_user: dict = Depends(get_current_user)):
    """Get available Power BI reports"""
    try:
        access_token = await get_powerbi_access_token()
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        url = f"https://api.powerbi.com/v1.0/myorg/groups/{POWER_BI_CONFIG['app_workspace_id']}/reports"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            reports_data = response.json()
            reports = []
            
            for report in reports_data.get("value", []):
                reports.append({
                    "id": report.get("id"),
                    "name": report.get("name"),
                    "description": report.get("description", ""),
                    "web_url": report.get("webUrl"),
                    "embed_url": report.get("embedUrl")
                })
            
            return {
                "reports": reports,
                "count": len(reports)
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch reports")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch reports: {str(e)}")


@router.get("/token/{report_id}", tags=["Power BI"])
async def get_embed_token(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get Power BI embed token for a report"""
    try:
        access_token = await get_powerbi_access_token()
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Prepare request body
        body = {
            "reports": [{"id": report_id}],
            "identities": [{
                "username": current_user["email"],
                "roles": [current_user.get("role", "student")]
            }],
            "lifetime": 60,  # Token lifetime in minutes
            "allowSaveAs": False
        }
        
        url = f"https://api.powerbi.com/v1.0/myorg/groups/{POWER_BI_CONFIG['app_workspace_id']}/reports/{report_id}/GenerateToken"
        
        response = requests.post(url, json=body, headers=headers)
        
        if response.status_code == 200:
            token_data = response.json()
            return {
                "token": token_data.get("token"),
                "token_id": token_data.get("tokenId"),
                "expiration": datetime.utcnow() + timedelta(minutes=60),
                "expires_in": 3600
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to generate token")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get embed token: {str(e)}")


@router.get("/dashboards", tags=["Power BI"])
async def get_powerbi_dashboards(current_user: dict = Depends(get_current_user)):
    """Get available Power BI dashboards"""
    try:
        access_token = await get_powerbi_access_token()
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        url = f"https://api.powerbi.com/v1.0/myorg/groups/{POWER_BI_CONFIG['app_workspace_id']}/dashboards"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            dashboards_data = response.json()
            dashboards = []
            
            for dashboard in dashboards_data.get("value", []):
                dashboards.append({
                    "id": dashboard.get("id"),
                    "display_name": dashboard.get("displayName"),
                    "web_url": dashboard.get("webUrl"),
                    "embed_url": dashboard.get("embedUrl")
                })
            
            return {
                "dashboards": dashboards,
                "count": len(dashboards)
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch dashboards")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch dashboards: {str(e)}")


@router.get("/dashboard-token/{dashboard_id}", tags=["Power BI"])
async def get_dashboard_embed_token(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get Power BI embed token for a dashboard"""
    try:
        access_token = await get_powerbi_access_token()
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Prepare request body
        body = {
            "dashboards": [{"id": dashboard_id}],
            "identities": [{
                "username": current_user["email"],
                "roles": [current_user.get("role", "student")]
            }],
            "lifetime": 60
        }
        
        url = f"https://api.powerbi.com/v1.0/myorg/groups/{POWER_BI_CONFIG['app_workspace_id']}/dashboards/{dashboard_id}/GenerateToken"
        
        response = requests.post(url, json=body, headers=headers)
        
        if response.status_code == 200:
            token_data = response.json()
            return {
                "token": token_data.get("token"),
                "expiration": datetime.utcnow() + timedelta(minutes=60),
                "expires_in": 3600
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to generate dashboard token")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get dashboard token: {str(e)}")


@router.post("/refresh", tags=["Power BI"])
async def refresh_powerbi(current_user: dict = Depends(get_current_user)):
    """Refresh Power BI dataset (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        access_token = await get_powerbi_access_token()
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Get datasets
        datasets_url = f"https://api.powerbi.com/v1.0/myorg/groups/{POWER_BI_CONFIG['app_workspace_id']}/datasets"
        datasets_response = requests.get(datasets_url, headers=headers)
        
        if datasets_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch datasets")
        
        datasets = datasets_response.json().get("value", [])
        refreshed = []
        
        for dataset in datasets:
            dataset_id = dataset.get("id")
            refresh_url = f"https://api.powerbi.com/v1.0/myorg/groups/{POWER_BI_CONFIG['app_workspace_id']}/datasets/{dataset_id}/refreshes"
            
            refresh_response = requests.post(refresh_url, headers=headers)
            
            if refresh_response.status_code in [200, 202]:
                refreshed.append(dataset.get("name"))
        
        return {
            "message": "Power BI datasets refreshed",
            "refreshed": refreshed,
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to refresh datasets: {str(e)}")
