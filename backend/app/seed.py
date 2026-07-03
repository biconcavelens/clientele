"""
Seed a handful of realistic fake clients with note history, including
notes that share entities/topics across clients (same vendor, same
conference, a referral) so the network-insights feature has something
real to find. Run with: python -m app.seed
"""
import asyncio
from datetime import datetime, timedelta

from sqlmodel import Session

from . import memory
from .db import Client, NoteMeta, engine, init_db

SEED = [
    {
        "name": "Dana Reyes",
        "role": "Product Lead",
        "company": "Acme Corp",
        "tags": "priority,renewal-q3",
        "days_since_contact": 2,
        "notes": [
            ("note", "Dana raised concerns about Q3 budget approval timing during our sync."),
            ("note", "Dana's kid Jack is starting college in the fall - she's stressed about the move-in logistics."),
            ("email", "Dana asked for a revised pricing tier proposal by end of week."),
            ("note", "Dana mentioned Acme has been struggling with their inventory-sync vendor missing deadlines."),
            ("note", "Dana attended DevSummit last quarter and met a few people from Bluepeak Studios there."),
            ("note", "Acme's Q2 delivery slipped by two weeks - Dana was frustrated but it's been smoothed over, no need to reopen it."),
        ],
    },
    {
        "name": "Marcus Chen",
        "role": "Ops Director",
        "company": "Northwind Retail",
        "tags": "expansion",
        "days_since_contact": 10,
        "notes": [
            ("note", "Marcus is also frustrated with their inventory-sync vendor - same recurring outages Acme has had."),
            ("email", "Northwind is hiring for a senior ops analyst role, struggling to find candidates."),
            ("call", "Marcus wants a demo of the enterprise tier for his leadership team next month."),
        ],
    },
    {
        "name": "Priya Nair",
        "role": "Founder",
        "company": "Bluepeak Studios",
        "tags": "startup",
        "days_since_contact": 5,
        "notes": [
            ("note", "Priya went to DevSummit last quarter and is always looking to expand her network there."),
            ("note", "Priya mentioned her former teammate is job-hunting for an ops analyst role after a layoff."),
            ("email", "Priya asked about flexible pricing for early-stage startups."),
        ],
    },
    {
        "name": "Sam Okafor",
        "role": "Head of Marketing",
        "company": "TrailMix Media",
        "tags": "at-risk",
        "days_since_contact": 68,
        "notes": [
            ("note", "Sam was evaluating us against a competitor last time we spoke."),
            ("note", "Sam prefers email over calls, based in London, usually replies in the evening UK time."),
        ],
    },
]


async def main():
    init_db()
    with Session(engine) as session:
        for entry in SEED:
            client = Client(
                name=entry["name"],
                role=entry["role"],
                company=entry["company"],
                tags=entry["tags"],
                last_contact=datetime.utcnow() - timedelta(days=entry["days_since_contact"]),
            )
            session.add(client)
            session.commit()
            session.refresh(client)

            for kind, text in entry["notes"]:
                await memory.remember_note(client.id, client.name, text, kind)
                session.add(NoteMeta(client_id=client.id, kind=kind, preview=text[:140]))
            session.commit()
            print(f"Seeded {client.name} ({client.company}) with {len(entry['notes'])} notes")


if __name__ == "__main__":
    asyncio.run(main())
