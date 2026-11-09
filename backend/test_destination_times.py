"""Destination suggestions must be reachable within the selected duration."""
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

import main


class DestinationTimesTest(unittest.IsolatedAsyncioTestCase):
    async def search(self, durations, limit=15):
        candidates = [{"name": str(i), "label": str(i), "lat": 30.26, "lon": float(i)} for i in range(len(durations))]

        def handle(request):
            import json
            payload = json.loads(request.content)
            duration = durations[int(payload["points"][1][0])]
            if duration is None:
                return httpx.Response(400, json={"message": "Point is out of bounds"})
            return httpx.Response(200, json={"paths": [{"time": duration * 60000}]})

        client = httpx.AsyncClient
        with patch.object(main, "search_places", return_value=candidates), patch.object(main.httpx, "AsyncClient", side_effect=lambda **kwargs: client(transport=httpx.MockTransport(handle), **kwargs)):
            return await main.places(q="cafe", lat=30.2672, lon=-97.7431, target_minutes=limit)

    async def test_cutoff_and_display_rounding(self):
        results = await self.search([14.1, 15, 15.01, 25, None])
        self.assertEqual([place["name"] for place in results], ["0", "1"])
        self.assertEqual([place["walking_minutes"] for place in results], [15, 15])

    async def test_shorter_duration_refilters(self):
        self.assertEqual(len(await self.search([4, 12], limit=15)), 2)
        results = await self.search([4, 12], limit=5)
        self.assertEqual([place["walking_minutes"] for place in results], [4])

    async def test_no_reachable_places(self):
        self.assertEqual(await self.search([16, None]), [])

    async def test_routing_outage_is_not_an_empty_result(self):
        candidates = [{"name": "Cafe", "lat": 30.26, "lon": -97.74}]
        client = httpx.AsyncClient
        transport = httpx.MockTransport(lambda request: httpx.Response(503))
        with patch.object(main, "search_places", return_value=candidates), patch.object(main.httpx, "AsyncClient", side_effect=lambda **kwargs: client(transport=transport, **kwargs)):
            with self.assertRaises(HTTPException) as error:
                await main.places(q="cafe", lat=30.2672, lon=-97.7431, target_minutes=15)
        self.assertEqual(error.exception.status_code, 503)
