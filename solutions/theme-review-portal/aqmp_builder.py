import struct
import base64

def build_amqp_frames(payload_body):
    frames = []
    
    # 1. Protocol header
    frames.append(b"AMQP\x00\x00\x09\x01")
    
    # 2. Connection.Start-Ok (simplified)
    # Method frame: class=10, method=11
    frame = struct.pack('>BI', 1, 0) + b'\x00\x0a\x00\x0b' + b'\x00\x00\x00\x00'
    frames.append(frame)
    
    # 3. Channel.Open (channel 1)
    frame = struct.pack('>BI', 1, 0) + b'\x00\x14\x00\x0a' + b'\x00'
    frames.append(frame)
    
    # 4. Basic.Publish (exchange='', routing_key='queue_name')
    # Ganti 'queue_name' dengan nama queue dari aplikasi
    routing_key = b'preview_queue'
    body = payload_body.encode()
    
    # Header frame
    header = struct.pack('>BIH', 2, 1, len(body))  # channel=1
    # Content header: class=60, weight=0, body size
    header += b'\x00\x3c\x00\x00' + struct.pack('>Q', len(body))
    frames.append(header)
    
    # Body frame
    frames.append(body)
    
    return [base64.b64encode(f).decode() for f in frames]

# Hasil serialize dari step 2
serialized = "O:14:\"PreviewBatch\":5:{...}"
segments = build_amqp_frames(serialized)
print(segments)
