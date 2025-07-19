from rest_framework import serializers
from .models import Country, Region, City, ChatRoom
from .models import Message

#///////ChatRoom///////

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name']

class RegionSerializer(serializers.ModelSerializer):
    country = CountrySerializer(read_only=True)
    country_id = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), source='country', write_only=True)

    class Meta:
        model = Region
        fields = ['id', 'name', 'country', 'country_id']

class CitySerializer(serializers.ModelSerializer):
    region = RegionSerializer(read_only=True)
    region_id = serializers.PrimaryKeyRelatedField(queryset=Region.objects.all(), source='region', write_only=True)

    class Meta:
        model = City
        fields = ['id', 'name', 'region', 'region_id']

class ChatRoomSerializer(serializers.ModelSerializer):
    cities = CitySerializer(many=True, read_only=True)
    city_ids = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), source='cities', many=True, write_only=True)
    creator = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'description', 'is_private', 'cities', 'city_ids', 'creator']

class ChatRoomCreateSerializer(serializers.ModelSerializer):
    city_ids = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), source='cities', many=True, write_only=True
    )

    class Meta:
        model = ChatRoom
        fields = ['name', 'description', 'is_private', 'city_ids']

    def create(self, validated_data):
        cities = validated_data.pop('cities')
        chat = ChatRoom.objects.create(**validated_data)
        chat.cities.set(cities)
        return chat
    
#//////Message///////

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)  # Можно заменить на ID, если надо
    class Meta:
        model = Message
        fields = ['id', 'chat', 'sender', 'text', 'created_at', 'edited', 'deleted']
        read_only_fields = ['sender', 'created_at', 'edited', 'deleted']

class MessageUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['text']
