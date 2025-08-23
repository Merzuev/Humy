from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient

from .models import Notification


class NotificationApiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        # У кастомной модели пользователя нет username — создаём пользователя только по email + password
        self.user = User.objects.create_user(
            email="test@example.com",
            password="pass12345",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_list_unread_and_mark_read(self):
        # создаём 3 непрочитанных и 1 прочитанное
        n1 = Notification.objects.create(user=self.user, type=Notification.Types.SYSTEM, payload={"a": 1})
        n2 = Notification.objects.create(user=self.user, type=Notification.Types.DM_BADGE, payload={"from_name": "A"})
        n3 = Notification.objects.create(user=self.user, type=Notification.Types.FRIEND_REQUEST, payload={"from_id": 2})
        n4 = Notification.objects.create(user=self.user, type=Notification.Types.PRESENCE, is_read=True)

        # список непрочитанных
        url_list = "/api/notifications/?is_read=false"
        res = self.client.get(url_list)
        self.assertEqual(res.status_code, 200)
        # results есть, если включена пагинация
        results = res.data.get("results", res.data)
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 3)

        # отметить два из них
        url_mark = "/api/notifications/mark-read/"
        res2 = self.client.post(url_mark, {"ids": [n1.id, n2.id]}, format="json")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["updated"], 2)

        # проверить, что остался 1 непрочитанный (n3)
        res3 = self.client.get(url_list)
        results3 = res3.data.get("results", res3.data)
        self.assertEqual(len(results3), 1)
        self.assertEqual(results3[0]["id"], n3.id)

        # отметить все оставшиеся непрочитанные
        res4 = self.client.post(url_mark, {"all": True}, format="json")
        self.assertEqual(res4.status_code, 200)
        self.assertEqual(res4.data["unread_count"], 0)
