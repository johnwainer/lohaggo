console.log('Testing cities API...')

fetch('http://localhost:3000/api/cities')
  .then(res => {
    console.log('Status:', res.status)
    return res.json()
  })
  .then(data => {
    console.log('Cities:', JSON.stringify(data, null, 2))
  })
  .catch(err => {
    console.error('Error:', err)
  })
