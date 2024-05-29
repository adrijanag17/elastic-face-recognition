# Multi-Tiered Elastic Face Recognition Application on AWS

This project implements a scalable and persistent multi-tiered face recognition application on AWS. It leverages EC2, S3, and SQS services, utilizing a pre-trained ResNet-34 model for face classification. The application dynamically scales to handle varying request loads efficiently.

## Features

- **Web, App, and Data Tiers**: Implements a three-tier architecture for robust performance and scalability.
- **Auto-Scaling**: Custom algorithm to dynamically adjust App Tier EC2 instances based on request load.
- **Concurrent Request Handling**: Utilizes AWS SQS for reliable and timely processing of face recognition tasks.

## Architecture

### Web Tier
- **EC2 Instance**: Listens for requests on port 8000.
- **Handles Requests**: Receives images from users, forwards them to the App Tier, and returns recognition results.
- **SQS Queues**: Uses request and response queues for communication with the App Tier.
- **Auto-Scaling Controller**: Implements custom logic for scaling App Tier instances.

### App Tier
- **EC2 Instances**: Launches instances using a pre-configured AMI with the necessary deep learning model and helper code.
- **Face Recognition**: Uses a pre-trained ResNet-34 model for image classification.
- **Auto-Scaling**: Automatically scales in response to the request queue length.

### Data Tier
- **S3 Buckets**: Stores input images and output recognition results in separate buckets for persistence.

## Made By

[Adrija Nag](https://github.com/adrijanag17)
