import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
// import jwtDecode from 'jwt-decode'; // Removed due to resolution issues
import { io } from 'socket.io-client';


// --- Axios API Setup ---
const API_URL = 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Helper function to replace jwt-decode ---
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to decode JWT:", e);
    return null;
  }
}

// --- Main App Component ---
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('login'); // login, register, feed, profile, generator, messages
  const [profileId, setProfileId] = useState(null); // For viewing other profiles

  const socket = useRef(null);

  useEffect(() => {
    if (token) {
      const decodedUser = decodeJwtPayload(token);
      if (decodedUser) {
        setUser({ ...decodedUser, token });
        setView('feed');
        
        // Connect to socket.io
        socket.current = io(API_URL, {
            query: { userId: decodedUser.id }
        });

        socket.current.on('connect', () => {
            console.log('Connected to socket server');
        });

        // Listen for new messages
        socket.current.on('newMessage', (data) => {
            // Using a custom modal/alert in a real app is better
            console.log(`New message from ${data.senderId}: ${data.message}`);
        });

      } else {
        console.error("Invalid token: could not decode.");
        handleLogout();
      }
    } else {
      setView('login');
    }

    return () => {
        if(socket.current) {
            socket.current.disconnect();
        }
    }

  }, [token]);

  const handleSetToken = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('login');
  };

  const navigateToProfile = (userId) => {
    setProfileId(userId);
    setView('profile');
  };

  return (
    <div className="app-container">
      {user && <Navbar setView={setView} handleLogout={handleLogout} userId={user.id} navigateToProfile={navigateToProfile} />}
      
      {!user ? (
        view === 'login' ? (
          <Login setToken={handleSetToken} setView={setView} />
        ) : (
          <Register setToken={handleSetToken} setView={setView} />
        )
      ) : (
        <>
          {view === 'feed' && <Feed currentUser={user} navigateToProfile={navigateToProfile} />}
          {view === 'generator' && <ImageGenerator />}
          {view === 'profile' && <Profile userId={profileId || user.id} currentUser={user} navigateToProfile={navigateToProfile} />}
          {/* Note: Messaging view is simplified */}
          {view === 'messages' && <div className="image-generator-container"><h3>Messaging</h3><p>Messaging feature is connected via WebSockets. Open another browser to test real-time alerts.</p></div>}
        </>
      )}
    </div>
  );
}


// --- Components ---

const Navbar = ({ setView, handleLogout, userId, navigateToProfile }) => {
    return (
        <nav className="main-nav">
            <h1>SocialApp</h1>
            <div className="nav-links">
                <button className="btn-secondary" onClick={() => setView('feed')}>Feed</button>
                <button className="btn-secondary" onClick={() => navigateToProfile(userId)}>My Profile</button>
                <button className="btn-secondary" onClick={() => setView('generator')}>AI Image</button>
                <button className="btn-secondary" onClick={() => setView('messages')}>Messages</button>
                <button className="btn-danger" onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    );
}

const Login = ({ setToken, setView }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/auth/login', { username, password });
      setToken(res.data.token);
    } catch (err) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="error">{error}</p>}
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn-primary">Login</button>
      </form>
      <div className="auth-toggle">
        <p>No account? <button onClick={() => setView('register')}>Register</button></p>
      </div>
    </div>
  );
};

const Register = ({ setToken, setView }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
    }
    try {
      const res = await api.post('/api/auth/register', { username, password });
      setToken(res.data.token);
    } catch (err) {
      setError('Username already exists');
    }
  };

  return (
    <div className="auth-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="error">{error}</p>}
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn-primary">Register</button>
      </form>
      <div className="auth-toggle">
        <p>Have an account? <button onClick={() => setView('login')}>Login</button></p>
      </div>
    </div>
  );
};


const Feed = ({ currentUser, navigateToProfile }) => {
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchPosts = useCallback(async () => {
        if (!hasMore) return;
        try {
            const res = await api.get(`/api/posts/feed?page=${page}&limit=10`);
            setPosts(prev => [...prev, ...res.data]);
            setHasMore(res.data.length > 0);
            setPage(prev => prev + 1);
        } catch (error) {
            console.error("Failed to fetch posts", error);
        }
    }, [page, hasMore]);

    useEffect(() => {
        fetchPosts();
    }, []); // Initial fetch

    const handleNewPost = (newPost) => {
        setPosts(prev => [newPost, ...prev]);
    }

    return (
        <div>
            <CreatePost onNewPost={handleNewPost} />
            {posts.map(post => (
                <PostItem key={post._id} post={post} currentUser={currentUser} navigateToProfile={navigateToProfile}/>
            ))}
            {hasMore && <button className="btn-secondary" style={{width: '100%', marginTop: '1rem'}} onClick={fetchPosts}>Load More</button>}
        </div>
    );
};

const CreatePost = ({ onNewPost }) => {
    const [text, setText] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        try {
            const res = await api.post('/api/posts', { text });
            onNewPost(res.data);
            setText('');
        } catch (error) {
            console.error("Failed to create post", error);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="create-post-form">
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="What's on your mind?"/>
            <button type="submit" className="btn-primary">Post</button>
        </form>
    );
}

const PostItem = ({ post, currentUser, navigateToProfile }) => {
    return (
        <div className="post-item">
            <div className="post-header" onClick={() => navigateToProfile(post.author._id)} style={{cursor: 'pointer'}}>
                <img src={post.author.profilePicture} alt={`${post.author.username}'s profile`} />
                <span className="post-author">{post.author.username}</span>
            </div>
            <p className="post-body">{post.text}</p>
            <div className="post-actions">
                <button className="btn-secondary">{post.likes.length} Likes</button>
                <button className="btn-secondary">{post.comments.length} Comments</button>
            </div>
        </div>
    );
}

const ImageGenerator = () => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setImage(null);
        try {
            const res = await api.post('/api/auth/generate-image', { prompt });
            setImage(res.data.image);
        } catch (err) {
            setError('Failed to generate image. The model might be loading. Please try again in a minute.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="image-generator-container">
            <h3>AI Image Generator</h3>
            <p>Enter a text prompt to create an image with AI. (e.g., "An astronaut riding a horse on Mars")</p>
            <form onSubmit={handleSubmit}>
                <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Enter your prompt..."/>
                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Generating...' : 'Generate Image'}
                </button>
            </form>
            {error && <p className="error" style={{textAlign: 'center', marginTop: '1rem'}}>{error}</p>}
            {loading && <div className="loader"></div>}
            {image && (
                <div className="image-output">
                    <img src={image} alt={prompt} />
                     <a href={image} download={`generated-image-${Date.now()}.png`} className="btn-primary">
                        Download Image
                    </a>
                </div>
            )}
        </div>
    );
}

const Profile = ({ userId, currentUser, navigateToProfile }) => {
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const isCurrentUser = userId === currentUser.id;
    
    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profileRes = await api.get(`/api/users/profile/${userId}`);
                setProfile(profileRes.data);
                // Check if the current user is following this profile
                setIsFollowing(profileRes.data.followers.includes(currentUser.id));

                const postsRes = await api.get(`/api/posts/user/${userId}`);
                setPosts(postsRes.data);

            } catch (error) {
                console.error("Failed to fetch profile", error);
            }
        };
        fetchProfile();
    }, [userId, currentUser.id]);

    const handleFollow = async () => {
        try {
            await api.post(`/api/users/follow/${userId}`);
            setIsFollowing(true);
            // Optionally, update follower count locally
            setProfile(p => ({ ...p, followers: [...p.followers, currentUser.id]}));
        } catch (error) {
            console.error("Failed to follow user", error);
        }
    };
    
    const handleUnfollow = async () => {
        try {
            await api.post(`/api/users/unfollow/${userId}`);
            setIsFollowing(false);
            // Optionally, update follower count locally
             setProfile(p => ({ ...p, followers: p.followers.filter(id => id !== currentUser.id)}));
        } catch (error) {
            console.error("Failed to unfollow user", error);
        }
    };

    if (!profile) return <div className="loader"></div>;

    return (
        <div>
            <div className="post-item"> {/* Reusing post-item style for profile header */}
                <div className="post-header">
                    <img src={profile.profilePicture} alt={profile.username} style={{width: '80px', height: '80px'}}/>
                    <div>
                        <h2>{profile.username}</h2>
                        <p>{profile.bio || "No bio yet."}</p>
                    </div>
                </div>
                <div style={{display: 'flex', gap: '2rem', marginBottom: '1rem'}}>
                    <span><strong>{posts.length}</strong> Posts</span>
                    <span><strong>{profile.followers.length}</strong> Followers</span>
                    <span><strong>{profile.following.length}</strong> Following</span>
                </div>
                {!isCurrentUser && (
                    isFollowing ? 
                    <button className="btn-secondary" onClick={handleUnfollow}>Unfollow</button> :
                    <button className="btn-primary" onClick={handleFollow}>Follow</button>
                )}
                 {isCurrentUser && (
                    <button className="btn-secondary">Edit Profile</button>
                )}
            </div>
            
            <h3>Posts</h3>
            {posts.map(post => (
                <PostItem key={post._id} post={post} currentUser={currentUser} navigateToProfile={navigateToProfile}/>
            ))}
        </div>
    )
}

export default App;


