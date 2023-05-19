import unittest
from flask import Flask
from pymongo import MongoClient
from flask_login import LoginManager
from unittest.mock import patch
from bson.objectid import ObjectId

class AvailabilityTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False
        self.client = self.app.test_client()

    def test_index(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)

    def test_main(self):
        response = self.client.get('/main')
        self.assertEqual(response.status_code, 200)

    def test_lend(self):
        response = self.client.get('/lend')
        self.assertEqual(response.status_code, 200)

    def test_howto(self):
        response = self.client.get('/howto')
        self.assertEqual(response.status_code, 200)

    def test_add_promo_route(self):
        with patch('flask.request') as mock_request, patch('Manage.add_promo') as mock_add_promo:
            mock_request.method = 'POST'
            mock_add_promo.return_value = "Promo added successfully"
            response = self.client.post('/add-promo')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data.decode('utf-8'), "Promo added successfully")

    def test_delete_promo_route(self):
        promo_id = str(ObjectId())
        with patch('flask.request') as mock_request, patch('Manage.delete_promo') as mock_delete_promo:
            mock_request.method = 'POST'
            mock_delete_promo.return_value = "Promo deleted successfully"
            response = self.client.post(f'/delete-promo/{promo_id}')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data.decode('utf-8'), "Promo deleted successfully")

    def test_edit_promo_route(self):
        promo_id = str(ObjectId())
        with patch('flask.request') as mock_request, patch('Manage.edit_promo') as mock_edit_promo:
            mock_request.method = 'POST'
            mock_edit_promo.return_value = "Promo edited successfully"
            response = self.client.post(f'/edit-promo/{promo_id}')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data.decode('utf-8'), "Promo edited successfully")

if __name__ == '__main__':
    unittest.main()

