/** Synthetic execution fixture; it does not validate bird-identification accuracy. */
export function wav(seconds, sampleRate = 16000) {
    const count = Math.round(seconds * sampleRate);
    const bytes = Buffer.alloc(44 + count * 2);
    bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
    bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
    bytes.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * (600 * t + 80 * t * t)) * Math.sin(Math.PI * (t % 1)) * .08;
        bytes.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
    }
    return bytes;
}
