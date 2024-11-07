import * as Tone from 'tone';

export class SoundManager {
    constructor() {
        // Increase default volume
        this.volume = -12;

        // Create reverb with gentler settings
        this.reverb = new Tone.Reverb({
            decay: 1.5,        // Shorter decay
            preDelay: 0.01,    // Faster pre-delay
            wet: 0.2          // Subtle reverb
        }).toDestination();

        // Add a limiter to prevent clipping while allowing louder sounds
        this.limiter = new Tone.Limiter(-1).toDestination();
        
        this.chorus = new Tone.Chorus({
            frequency: 1.5,    // Slower modulation
            delayTime: 2.0,
            depth: 0.2,       // Less intense chorus
            wet: 0.15         // Subtle chorus
        }).connect(this.limiter);

        // Initialize synth with marimba-like settings
        this.synth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3,  // Increased for more harmonic richness
            modulationIndex: 2,
            oscillator: {
                type: "sine",
                partials: [1, 0.5, 0.25]  // Added partials for richer tone
            },
            envelope: {
                attack: 0.02,  // Faster attack for marimba-like response
                decay: 0.3,    // Longer decay
                sustain: 0.2,  // Lower sustain for more percussive sound
                release: 0.8   // Longer release for natural fade
            },
            modulation: {
                type: "triangle"  // Changed to triangle for warmer sound
            },
            modulationEnvelope: {
                attack: 0.005,
                decay: 0.2,
                sustain: 0.2,
                release: 0.5
            },
            volume: this.volume
        }).connect(this.chorus);

        // A minor pentatonic scale across three octaves
        this.baseNote = 'A4'; // Root note
        this.scale = ['A', 'C', 'D', 'E', 'G']; // Pentatonic scale notes
        this.notes = {
            high: ['A5', 'C6', 'D6', 'E6', 'G6'],
            mid:  ['A4', 'C5', 'D5', 'E5', 'G5'],
            low:  ['A3', 'C4', 'D4', 'E4', 'G4']
        };

        // Melodic progression tracking
        this.lastNoteIndex = 0;
        this.melodyDirection = 1; // 1 for ascending, -1 for descending
        this.melodicPattern = [0, 2, 4, 3, 1]; // Pentatonic pattern for more musical progression
        this.currentPatternIndex = 0;
        
        this.isPlaying = false;
        this.lastPlayTime = 0;
        this.minTimeBetweenNotes = 200; // Adjusted for more musical timing
        this.neuronNotes = new Map();
    }

    setVolume(value) {
        this.volume = value;
        this.synth.volume.value = value;
    }

    transposeToPentatonic(note) {
        const noteIndex = this.scale.indexOf(note.slice(0, -1));
        const octave = parseInt(note.slice(-1));
        return this.scale[noteIndex] + octave;
    }

    assignNoteRange(neuronId) {
        // Create a melodic progression using the pattern
        const ranges = ['mid', 'high', 'low'];
        const range = ranges[neuronId % 3];
        
        // Use melodic pattern for note selection
        const noteIndex = this.melodicPattern[this.currentPatternIndex];
        this.currentPatternIndex = (this.currentPatternIndex + 1) % this.melodicPattern.length;

        // Store both range and preferred note index
        this.neuronNotes.set(neuronId, {
            range: range,
            noteIndex: noteIndex
        });

        // Update melody direction for variety
        if (this.lastNoteIndex >= this.notes[range].length - 1) {
            this.melodyDirection = -1;
        } else if (this.lastNoteIndex <= 0) {
            this.melodyDirection = 1;
        }
        this.lastNoteIndex = (this.lastNoteIndex + this.melodyDirection) % this.notes[range].length;

        return range;
    }

    playNeuronFiring(weight = 0.5, speed = 0.5, neuronId, isIsolated = false, hasDC = false, distance = 0) {
        const now = Date.now();
        if (now - this.lastPlayTime < this.minTimeBetweenNotes) {
            return;
        }
        this.lastPlayTime = now;
    
        if (!this.isPlaying) {
            Tone.start();
            this.isPlaying = true;
        }
    
        let noteData = this.neuronNotes.get(neuronId);
        if (!noteData) {
            const range = this.assignNoteRange(neuronId);
            noteData = this.neuronNotes.get(neuronId);
        }
    
        // Use the assigned note index for more melodic progression
        const notes = this.notes[noteData.range];
        const note = notes[noteData.noteIndex];
    
        weight = Math.max(0.2, Math.min(0.8, weight));
        speed = Math.max(0.2, Math.min(0.8, speed));
    
        let envelope, modulation, effects;
        
        if (isIsolated) {
            if (hasDC) {
                envelope = {
                    attack: 0.02,
                    decay: 0.3,
                    sustain: 0.0,
                    release: 0.0
                };
                modulation = {
                    harmonicity: 2,
                    modulationIndex: 1.5
                };
                effects = {
                    reverbWet: 0.0,
                    chorusWet: 0.2
                };
            } else {
                envelope = {
                    attack: 0.02,
                    decay: 0.0,
                    sustain: 0.1,
                    release: 0.0
                };
                modulation = {
                    harmonicity: 2,
                    modulationIndex: 1
                };
                effects = {
                    reverbWet: 0.0,
                    chorusWet: 0.0
                };
            }
        } else {
            envelope = {
                attack: 0.02,
                decay: 0.2 + weight * 0.2,
                sustain: 0.1 + weight * 0.1,
                release: 0.3 + distance * 0.1
            };
            modulation = {
                harmonicity: 2 + weight,
                modulationIndex: 1 + weight
            };
            effects = {
                reverbWet: Math.min(0.3, distance * 0.1),
                chorusWet: 0.1 + speed * 0.1
            };
        }
    
        this.synth.set({
            envelope: envelope,
            modulationEnvelope: envelope,
            harmonicity: modulation.harmonicity,
            modulationIndex: modulation.modulationIndex
        });
    
         this.reverb.wet.value = effects.reverbWet;
         this.chorus.wet.value = effects.chorusWet;
     
         const velocity = isIsolated 
             ? (hasDC ? 0.6 : 0.4)
             : (0.5 + (weight * 0.3));
         const duration = Math.max(0.1, envelope.sustain + envelope.release);
         
         setTimeout(() => {
             this.synth.triggerAttackRelease(note, duration, Tone.now(), velocity);
         }, 0);
     }
 
     cleanup() {
         if (this.synth) {
             this.synth.dispose();
         }
         if (this.chorus) {
             this.chorus.dispose();
         }
         if (this.reverb) {
             this.reverb.dispose();
         }
         if (this.limiter) {
             this.limiter.dispose();
         }
     }
 }