import os
import requests

def test_supabase_doctors_public_endpoint():
    url = "https://pkvwnsigucncdwrjtggs.supabase.co/rest/v1/doctors?select=id,name,specialty,fee,verification_status"
    headers = {
        "apikey": "sb_publishable_ZU0BqFxZTXdTOxUOmhRr1w_CR3myIy8",
        "Authorization": "Bearer sb_publishable_ZU0BqFxZTXdTOxUOmhRr1w_CR3myIy8"
    }
    response = requests.get(url, headers=headers, timeout=10)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    doctors = response.json()
    assert isinstance(doctors, list), "Expected list of doctors"
    assert len(doctors) > 0, "Expected at least 1 doctor in database"
    print(f"PASS: Verified {len(doctors)} doctors from Supabase REST endpoint")

if __name__ == "__main__":
    test_supabase_doctors_public_endpoint()
