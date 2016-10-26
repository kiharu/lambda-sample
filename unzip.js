console.log('Loading event');
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var node_zip = require('node-zip');
var mime = require('mime-types');
var async = require('async');

// 解凍ファイルの保存先バケット名
var unzip_bucket = 'bucket-name';

//解凍したファイルの保存処理
function unzip_file(bucket, key, body, content_type, callback) {
  s3.putObject({
    Bucket: bucket,
    Key: encodeURIComponent(key),
    Body: new Buffer(body, 'binary'),
    ContentType: content_type
  }, callback);
}

exports.handler = function(event, context) {
  console.log('Received event:');
  console.log(JSON.stringify(event, null, '  '));

  // Get the object from the event and show its content type
  var bucket = event.Records[0].s3.bucket.name;
  var key = decodeURIComponent(event.Records[0].s3.object.key);

  s3.getObject({Bucket:bucket, Key:key},
    function(err,data) {
      if (err) {
        context.done(null, '');
        console.log('error getting object ' + key + ' from bucket ' + bucket +
          '. Make sure they exist and your bucket is in the same region as this function.');
        context.done('error','error getting file'+err);
      }
      else {
        //zipファイルかどうか判断
        if (data.ContentType == 'application/zip') {
          var zip = new node_zip(data.Body, {base64: false, checkCRC32: true});

          //zipの中身を1件ずつunzip
          async.forEach(Object.keys(zip.files), function(i, next) {
            var f = zip.files[i];
            console.log(f.name);
            var mimetype = mime.lookup(f.name);
            if (mimetype == false) {
              mimetype = 'application/octet-stream';
            }
            console.log(mimetype);
            unzip_file(unzip_bucket, f.name, f.asBinary(), mimetype, function (err) {
              if (err) {
                context.done(err, "unzip error");
              }
              next();
            });
          }, function (err) {
            if (err) {
              context.done(err, "async forEach error");
            }
            console.log('finish');
            context.done(null, '');
          });

        }
        else {
          console.log('this is not a zip file!');
          context.done(null, '');
        }

      }
    }
  );
};