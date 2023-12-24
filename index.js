import express from 'express'
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500;
const ADMIN = 'Admin'
 
const app = express()


app.use(express.static(path.join(__dirname, 'public')))

const expressServer = app.listen(PORT, () => {
  console.log(`listening ${PORT}`)
})

// state
const UsersState = {
  users: [],
  setUsers: function(newUsersArray){
    this.users = newUsersArray
  }
}

const io = new Server(expressServer, {
  cors: {
    origin: '*'
  }
})


io.on('connection', socket => {
  socket.emit('message', buildMsg(ADMIN, 'Welcome to chat!'))

  socket.on('enterRoom', ({name, room}) => {

    //leave previous room
    const prevRoom = getUser(socket.id)?.room

    if(prevRoom){
      socket.leave(prevRoom)
      io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`))
    }

    const user = activateUser(socket.id, name, room)
    
    // Cannot update previous room users list until after the state upldate in activate user
    if(prevRoom){
      io.to(prevRoom).emit('userList', {
        users: getUsersInRoom(prevRoom)
      })
    }

    socket.join(user.room)

    //to user who joined
    socket.emit('message', buildMsg(ADMIN, `You have joined the ${user.room} chat room`))

    //to anyone else
    socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

    //Update user list for room
    io.to(user.room).emit('userList', {
      users: getUsersInRoom(user.room)
    })

    // Update rooms list for everyone 
    io.emit('roomList', {
      rooms: getAllActiveRooms()
    })
  })

  socket.on('disconnect', () => {
    const user = getUser(socket.id)
    userLeavesApp(socket.id)

    if(user) {
      io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))
      
      io.to(user.room).emit('userList', {
        users: getUsersInRoom(user.room)
      })

      io.emit('room', {
        rooms: getAllActiveRooms()
      })
    }
  })
  
  socket.on('message', ({name, text}) => {
    const room = getUser(socket.id)?.room
    if(room){
      io.to(room).emit('message', buildMsg(name, text))
    }

  })
  
 

  socket.on('activity', (name) => {
    const room = getUser(socket.id)?.room
    if(room){
      socket.broadcast.to(room).emit('activity', name)
    }
  })
})

function buildMsg(name, text){
  return {
    name, 
    text,
    time: new Intl.DateTimeFormat('defalut', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }).format(new Date())
  }
}

//user fucntions

function activateUser(id, name, room){
  const user = {id, name, room}
  UsersState.setUsers([
    ...UsersState.users.filter(user => user.id !== id),
    user
  ])
  return user
}

function userLeavesApp(id){
  UsersState.setUsers(
    UsersState.users.filter(user => user.id !== id)
  )
}

function getUser(id){
  return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room){
  return UsersState.users.filter(user => user.room === room)
}

function getAllActiveRooms() {
  return Array.from(new Set(UsersState.users.map(user => user.room)))
}
