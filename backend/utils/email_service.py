import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', 'campusfindernoreply@gmail.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', 'your_app_password_here')       

def send_match_email(to_email, item_name, score):
    if not to_email or to_email == 'UNKNOWN_USER' or '@' not in to_email:
        print(f'Skipping email to {to_email} (invalid email address)')
        return

    print(f'--- Sending match notification email to {to_email} for {item_name} ---')
    msg = MIMEMultipart()
    msg['From'] = SMTP_USERNAME
    msg['To'] = to_email
    msg['Subject'] = f'Campus Finder: Potential Match Found for {item_name}!'

    body = f'''Hello!

Great news! Our AI system found a potential match for your item: {item_name}.
Match Confidence: {score}%

Log in to your Campus Finder Dashboard to view the details and start a chat to verify with the other student.

Thanks,
Campus Finder AI bot'''

    msg.attach(MIMEText(body, 'plain'))
    if SMTP_PASSWORD != 'your_app_password_here':
        try:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            text = msg.as_string()
            server.sendmail(SMTP_USERNAME, to_email, text)
            server.quit()
            print(f'Email successfully sent to {to_email}')
        except Exception as e:
            print(f'Failed to send email to {to_email}: {e}')
    else:
        print(f'[Simulation Mode] Email simulated sent to {to_email}')

