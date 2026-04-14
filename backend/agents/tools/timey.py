import json
from datetime import datetime
import time
from tzlocal import get_localzone

async def get_current_datetime_json():
    now = datetime.now()
    local_tz = get_localzone()

    is_dst = time.daylight and time.localtime().tm_isdst
    utc_offset_seconds = time.altzone if is_dst else time.timezone
    utc_offset_hours = -utc_offset_seconds / 3600

    datetime_data = {
        'date': now.strftime('%Y-%m-%d'),
        'time': now.strftime('%H:%M:%S'),
        'timezone': str(local_tz),
        'utc_offset': f"UTC{utc_offset_hours:+g}",
        'datetime_iso': now.isoformat(),
        'timestamp': now.timestamp()
    }
    return json.dumps(datetime_data, indent=2)
