// Quick R2 connection test
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import 'dotenv/config'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

async function test() {
  const bucket = process.env.R2_BUCKET_NAME

  // 1. List objects
  console.log('=== [1] Listing bucket:', bucket, '===')
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }))
    console.log('✅ List OK — KeyCount:', list.KeyCount)
    if (list.Contents) list.Contents.forEach(o => console.log('  ', o.Key, o.Size, 'bytes'))
  } catch (e) {
    console.error('❌ List FAILED:', e.message)
    return
  }

  // 2. Upload test file
  const testKey = 'uploads/_r2-test.txt'
  console.log('\n=== [2] Upload test file:', testKey, '===')
  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from('R2 connection test - ' + new Date().toISOString()),
      ContentType: 'text/plain',
    }))
    console.log('✅ Upload OK')
    console.log('   Public URL:', `${process.env.R2_PUBLIC_URL}/${testKey}`)
  } catch (e) {
    console.error('❌ Upload FAILED:', e.message)
    return
  }

  // 3. Cleanup
  console.log('\n=== [3] Delete test file ===')
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }))
    console.log('✅ Delete OK')
  } catch (e) {
    console.error('⚠️ Delete failed (non-critical):', e.message)
  }

  console.log('\n🎉 R2 koneksi berhasil. Upload via app seharusnya masuk ke R2.')
}

test()
