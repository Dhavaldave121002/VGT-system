import urllib.request
import os

os.makedirs(r'c:\Users\vi1\Desktop\Calender\assets', exist_ok=True)

opener = urllib.request.build_opener()
opener.addheaders = [('User-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]
urllib.request.install_opener(opener)

try:
    urllib.request.urlretrieve('https://img.freepik.com/premium-photo/3d-avatar-boy-character_914455-603.jpg', r'c:\Users\vi1\Desktop\Calender\assets\male_avatar.jpg')
    print("Male avatar downloaded.")
except Exception as e:
    print("Error downloading male:", e)

try:
    urllib.request.urlretrieve('https://img.freepik.com/premium-photo/3d-avatar-girl-character_914455-604.jpg', r'c:\Users\vi1\Desktop\Calender\assets\female_avatar.jpg')
    print("Female avatar downloaded.")
except Exception as e:
    print("Error downloading female:", e)
