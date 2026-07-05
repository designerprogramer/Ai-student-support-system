import django_filters
from .models import Complaint


class ComplaintFilter(django_filters.FilterSet):
    created_from = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_to = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = Complaint
        fields = ['status', 'priority', 'source', 'category', 'student']
