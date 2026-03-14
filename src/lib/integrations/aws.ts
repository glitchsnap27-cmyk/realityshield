import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const tableName = process.env.DYNAMODB_TABLE;
const bucket = process.env.ARTIFACT_BUCKET;
const topicArn = process.env.SNS_TOPIC_ARN;

function clients() {
  return {
    ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region })),
    s3: new S3Client({ region }),
    sns: new SNSClient({ region }),
  };
}

export async function persistRunStateAws(run: {
  id: string;
  stage: string;
  status: string;
  updatedAt: string;
  finalDecision?: { status: string; confidence: number };
}) {
  if (!tableName) {
    return { enabled: false, reason: "DYNAMODB_TABLE not set" };
  }

  try {
    const { ddb } = clients();
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `RUN#${run.id}`,
          sk: "STATE",
          runId: run.id,
          stage: run.stage,
          status: run.status,
          updatedAt: run.updatedAt,
          finalDecisionStatus: run.finalDecision?.status,
          finalDecisionConfidence: run.finalDecision?.confidence,
        },
      }),
    );

    return { enabled: true, persisted: true };
  } catch (error) {
    return {
      enabled: true,
      persisted: false,
      error: error instanceof Error ? error.message : "Unknown DynamoDB error",
    };
  }
}

export async function uploadProofPackAws(runId: string, proofPack: unknown) {
  if (!bucket) {
    return { enabled: false, reason: "ARTIFACT_BUCKET not set" };
  }

  try {
    const { s3 } = clients();
    const key = `proof-packs/${runId}.json`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: "application/json",
        Body: JSON.stringify(proofPack, null, 2),
      }),
    );

    return { enabled: true, uploaded: true, key };
  } catch (error) {
    return {
      enabled: true,
      uploaded: false,
      error: error instanceof Error ? error.message : "Unknown S3 error",
    };
  }
}

export async function publishExceptionAws(payload: {
  runId: string;
  reason: string;
  confidence: number;
}) {
  if (!topicArn) {
    return { enabled: false, reason: "SNS_TOPIC_ARN not set" };
  }

  try {
    const { sns } = clients();
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: `RealityShield Exception ${payload.runId}`,
        Message: JSON.stringify(payload, null, 2),
      }),
    );

    return { enabled: true, published: true };
  } catch (error) {
    return {
      enabled: true,
      published: false,
      error: error instanceof Error ? error.message : "Unknown SNS error",
    };
  }
}
