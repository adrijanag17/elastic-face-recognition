const express = require("express");
const multer = require("multer");
const aws = require("aws-sdk");

const app = express();
const PORT = 8000;

const upload = multer({ storage: multer.memoryStorage() });

aws.config.update({ region: 'us-east-1' });
const sqs = new aws.SQS({ apiVersion: '2012-11-05' });
const s3 = new aws.S3();
const ec2 = new aws.EC2({ apiVersion: "2016-11-15" });

const MAX_INSTANCES = 19;
global.numRunningInstances = 0;


const requestQueue = [];


async function uploadFileToS3(filename, buffer) {
    const uploadParams = {
        Bucket: '1225464032-in-bucket',
        Key: filename,
        Body: buffer,
    };
    return s3.upload(uploadParams).promise();
}


async function sendMessageToSQS(filename) {
    const reqParams = {
        MessageBody: filename,
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/992382850355/1225464032-req-queue'
    };
    return sqs.sendMessage(reqParams).promise();
}


async function calcReqQueueDepth() {
    const depthParams = {
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/992382850355/1225464032-req-queue',
        AttributeNames: ['ApproximateNumberOfMessages']
    };
      
    const attr = await sqs.getQueueAttributes(depthParams).promise();
    const numMsg  = parseInt(attr.Attributes.ApproximateNumberOfMessages);
    return numMsg;
}

async function receiveMessageFromSQS() {
    const respParams = {
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        MessageAttributeNames: ["All"],
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/992382850355/1225464032-resp-queue'
    };

    while (true) {
        const data = await sqs.receiveMessage(respParams).promise();
        if (data.Messages && data.Messages.length > 0) {
            const classificationResult = data.Messages[0].Body;
            
            const imageId = classificationResult.split(":")[0];

            const request = requestQueue.find((queueItem) => 
                queueItem.imageId === imageId
            );
            if (request) {
                request.res.send(classificationResult);
                requestQueue.splice(requestQueue.indexOf(request), 1);
            }
            await deleteMessageFromSQS(data.Messages[0].ReceiptHandle);
        }
        let queueDepth = await calcReqQueueDepth();
        if (queueDepth === 0) {
            global.numRunningInstances = 0;
        }
    }
    
}


async function deleteMessageFromSQS(receiptHandle) {
    const deleteParams = {
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/992382850355/1225464032-resp-queue',
        ReceiptHandle: receiptHandle,
    };
    return sqs.deleteMessage(deleteParams).promise();
}


async function createEC2Instance() {
    const ec2Params = {
        ImageId: 'ami-0839708ca401ebdec',
        InstanceType: 't2.micro',
        MinCount: 1,
        MaxCount: 1,
        KeyName: 'key_pair_apptier',
        TagSpecifications: [
            {
                ResourceType: 'instance',
                Tags: [
                    {
                        Key: 'Name',
                        Value: `app-tier-instance-${global.numRunningInstances}`,
                    }
                ]
            },
        ],
    };
    await ec2.runInstances(ec2Params).promise();
}



app.post('/', upload.single('inputFile'), async (req, res) => {
    try {
        const filename = req.file.originalname;
        const imageId = filename.split(".")[0];
        requestQueue.push({imageId, res});

        
        await uploadFileToS3(filename, req.file.buffer);
        await sendMessageToSQS(filename);
        global.numRunningInstances += 1;


        if (global.numRunningInstances <= MAX_INSTANCES) {
            await createEC2Instance();
        }
        
        await receiveMessageFromSQS();

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
