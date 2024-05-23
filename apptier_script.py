import boto3
import subprocess
import requests

AWS_ACCESS_KEY_ID = ""
AWS_SECRET_ACCESS_KEY = ""

sqs =boto3.client("sqs", region_name="us-east-1", 
                      aws_access_key_id=AWS_ACCESS_KEY_ID, 
                      aws_secret_access_key=AWS_SECRET_ACCESS_KEY)


s3 = boto3.client('s3', region_name="us-east-1",
                  aws_access_key_id=AWS_ACCESS_KEY_ID, 
                  aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

ec2 = boto3.client('ec2', region_name='us-east-1',
                   aws_access_key_id=AWS_ACCESS_KEY_ID,
                   aws_secret_access_key=AWS_SECRET_ACCESS_KEY)


def run_face_recognition(filename):
    command = ["python3", "/home/ubuntu/face_recognition.py", f"/home/ubuntu/images/{filename}"]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    output = result.stdout
    return output


def send_message(result):
    resp_queue = sqs.get_queue_url(QueueName='1225464032-resp-queue')
    result = sqs.send_message(
        QueueUrl=resp_queue['QueueUrl'],
        MessageBody=(result)
    )


def main():
        
    while True:
        req_queue = sqs.get_queue_url(QueueName='1225464032-req-queue')
        message = sqs.receive_message(
            QueueUrl=req_queue['QueueUrl'],
            MaxNumberOfMessages=1,
            WaitTimeSeconds=20,
            MessageAttributeNames=['All']
        )

        if 'Messages' in message:

            filename = message['Messages'][0]['Body']
            image_id = filename.split(".")[0]

            # image_path = f"{dir_path}/images/{filename}"
            image_path = f"/home/ubuntu/images/{filename}"
            s3.download_file( 
                Filename=image_path, 
                Bucket="1225464032-in-bucket", 
                Key=filename
            )

            result = f"{image_id}:{run_face_recognition(filename)}"
            # print(result)
            send_message(result)

            s3.put_object(
                Body=f'{result}', 
                Bucket='1225464032-out-bucket', 
                Key=f'{image_id}'
            )
            receipt_handle = message['Messages'][0]['ReceiptHandle']
            sqs.delete_message(
                QueueUrl=req_queue['QueueUrl'],
                ReceiptHandle=receipt_handle
            )

        else:
            response = sqs.get_queue_attributes(
                QueueUrl=req_queue['QueueUrl'],
                AttributeNames=['ApproximateNumberOfMessages']
            )
            num_messages = int(response['Attributes']['ApproximateNumberOfMessages'])
            if num_messages == 0:
                response = requests.get('http://169.254.169.254/latest/meta-data/instance-id')
                instance_id = response.text
                if instance_id:
                    response = ec2.terminate_instances(InstanceIds=[instance_id])


main()