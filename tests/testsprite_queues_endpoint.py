import os
import requests

def test_supabase_clinic_queues_endpoint():
    url = "https://pkvwnsigucncdwrjtggs.supabase.co/rest/v1/clinic_queues?select=id,doctor_id,queue_date,current_token,total_tokens,status"
    headers = {
        "apikey": "sb_publishable_ZU0BqFxZTXdTOxUOmhRr1w_CR3myIy8",
        "Authorization": "Bearer sb_publishable_ZU0BqFxZTXdTOxUOmhRr1w_CR3myIy8"
    }
    response = requests.get(url, headers=headers, timeout=10)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    queues = response.json()
    assert isinstance(queues, list), "Expected list of clinic queues"
    print(f"PASS: Verified {len(queues)} clinic queues from Supabase REST endpoint")

if __name__ == "__main__":
    test_supabase_clinic_queues_endpoint()
