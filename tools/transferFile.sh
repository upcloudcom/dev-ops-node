#!/usr/bin/expect

#Shell command to transfer file using scp on Linux
#Don't support windows yet for now
#Usage
# localFIle remoteAddr remoteFile user password isToRemote

set localFile [lindex $argv 0]
set remoteAddr [lindex $argv 1]
set remoteFile [lindex $argv 2]
set user [lindex $argv 3]
set password [lindex $argv 4]
set isToRemote [lindex $argv 5]

if {$isToRemote == "1"} {
  send_user "Transfer file to remote machine\n"
  set dirName [exec dirname $remoteFile]
  # Disable StrictHostKeyChecking
  exec echo -e "Host $remoteAddr\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
  # Clean and recreate the directory
  spawn ssh $user@$remoteAddr "rm -rf $dirName && mkdir -p $dirName"
  set timeout 1800
  expect {
    "*assword:" {send "$password\r";exp_continue}
  }
  spawn scp $localFile $user@$remoteAddr:$remoteFile
} else {
  exec echo -e "Host $remoteAddr\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
  send_user "Transfer file from remote machine\n"
  spawn scp $user@$remoteAddr:$remoteFile $localFile
}

set timeout 1800
expect {
  "*assword:" {send "$password\r";exp_continue}
}