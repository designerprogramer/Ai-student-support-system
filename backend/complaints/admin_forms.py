from django import forms
from django.contrib.auth import get_user_model

from .models import Role


User = get_user_model()


def normalize_role_name(role_name: str) -> str:
    return (role_name or '').strip().lower().replace('-', '_').replace(' ', '_')


class RoleAwareUserCreationForm(forms.ModelForm):
    role = forms.ModelChoiceField(queryset=Role.objects.order_by('name'), required=True)
    student_id = forms.CharField(max_length=50, required=False)
    username = forms.CharField(max_length=50, required=False)
    email = forms.EmailField(required=False)
    password1 = forms.CharField(label='Password', widget=forms.PasswordInput, strip=False)
    password2 = forms.CharField(label='Confirm password', widget=forms.PasswordInput, strip=False)

    class Meta:
        model = User
        fields = ('role', 'student_id', 'username', 'email')

    def clean(self):
        cleaned_data = super().clean()
        role = cleaned_data.get('role')
        student_id = (cleaned_data.get('student_id') or '').strip()
        username = (cleaned_data.get('username') or '').strip()
        email = (cleaned_data.get('email') or '').strip().lower()
        password1 = cleaned_data.get('password1')
        password2 = cleaned_data.get('password2')

        role_name = normalize_role_name(role.name if role else '')

        if role_name == 'student':
            if not student_id:
                self.add_error('student_id', 'Student ID is required for student users.')
            if len(student_id) > 50:
                self.add_error('student_id', 'Student ID must be 50 characters or fewer.')
            if not email:
                self.add_error('email', 'Email is required for student OTP login and password reset.')
            cleaned_data['username'] = student_id
            cleaned_data['email'] = email
        else:
            if not username:
                self.add_error('username', 'Username is required for non-student users.')
            if len(username) > 50:
                self.add_error('username', 'Username must be 50 characters or fewer.')
            if not email:
                self.add_error('email', 'Email is required for non-student users.')
            cleaned_data['username'] = username
            cleaned_data['email'] = email

        if password1 and password2 and password1 != password2:
            self.add_error('password2', 'Passwords do not match.')

        if cleaned_data.get('username') and User.objects.filter(username=cleaned_data['username']).exists():
            self.add_error('username', 'A user with this username already exists.')
        if cleaned_data.get('email') and User.objects.filter(email__iexact=cleaned_data['email']).exists():
            self.add_error('email', 'A user with this email already exists.')

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = self.cleaned_data.get('username', '').strip()
        user.email = self.cleaned_data.get('email', '').strip().lower()
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user
