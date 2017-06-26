const idGenerator = require('../utils/id_generator')

describe('test id generator', function () {
  it('should generate short id', function (done) {
    console.log(idGenerator.newManagedProjectID())
  })
})

describe('test image parser', function() {
  it('should parse image correctly', function(done) {
    var testcases = [
      '192.168.1.113/tenxcloud/ubuntu:v1',
      '192.168.1.113/tenxcloud/ubuntu',
      '192.168.1.113/ubuntu:v1',
      '192.168.1.113/ubuntu',
      'tenxcloud/ubuntu:v1',
      'tenxcloud/ubuntu',
      'ubuntu:v1',
      'ubuntu'
    ]
    testcases.forEach(function(onecase){
      var host = '', image = '', tag = ''
      var separatorNumber = 0
      var letter = ""
      for (var i = 0; i< onecase.length; i++) {
        ch = onecase[i]
        letter += ch
        if (ch === '/') {
          if (separatorNumber == 0) {
            // Find the first one
            host = letter
            letter = ''
          } else if (separatorNumber == 1) {
            // Find the second one
            image += letter
            letter = ''
          }
          separatorNumber++
        } else if (ch === ':') {
          image += letter
          letter = ''
          // Tag found
          tag = '*'
        }
      }
      // left is the tag
      if (tag == '*') {
        tag = letter
      } else {
        image += letter
      }
      // Maybe from docker hub with no host
      if (host.indexOf('.') < 0) {
        image = host + image
        host = ''
      } else {
        // Trim the host/image
        host = host.replace('/', '')
      }
      image = image.replace(':', '')
      console.log("------------------------")
      console.log("host: " + host)
      console.log("image: " + image)
      console.log("tag: " + tag)
      console.log("------------------------")
    })
    done()
  })
})
