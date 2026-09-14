package com.flstudio.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flstudio.mobile.audio.AudioEngine
import com.flstudio.mobile.audio.SamplerMode

@Composable
fun DawScreen(audioEngine: AudioEngine) {
    var isPlaying by remember { mutableStateOf(false) }
    var bpm by remember { mutableStateOf(120) }
    var activeTab by remember { mutableStateOf("Playlist") }
    var samplerMode by remember { mutableStateOf(SamplerMode.STRETCH) }
    var pitchSemitones by remember { mutableStateOf(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF101117))
    ) {
        // TOP TRANSPORT BAR
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(Color(0xFF181A24))
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Play / Pause / Record
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                IconButton(
                    onClick = {
                        isPlaying = !isPlaying
                        if (isPlaying) audioEngine.startPlayback() else audioEngine.pausePlayback()
                    },
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isPlaying) Color(0xFF10B981) else Color(0xFF242938))
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White
                    )
                }

                // BPM display
                Text(
                    text = "$bpm BPM",
                    color = Color(0xFFF97316),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }

            // Central Navigation Tabs
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Playlist", "Piano Roll", "Synth Rack", "FL Sampler", "Mixer").forEach { tab ->
                    val isSelected = activeTab == tab
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (isSelected) Color(0xFFF97316) else Color(0xFF222634))
                            .clickable { activeTab = tab }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = tab,
                            color = if (isSelected) Color.White else Color(0xFF94A3B8),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        // MAIN WORKSPACE BODY
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(12.dp)
        ) {
            when (activeTab) {
                "FL Sampler" -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF181A24))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "FL STUDIO SAMPLER MODE (KOTLIN NATIVE)",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )

                        // Mode Selector: Resample / Stretch / Auto
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(
                                SamplerMode.RESAMPLE to "RESAMPLE",
                                SamplerMode.STRETCH to "STRETCH",
                                SamplerMode.AUTO to "AUTO"
                            ).forEach { (mode, label) ->
                                val isSelected = samplerMode == mode
                                Button(
                                    onClick = { samplerMode = mode },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (isSelected) Color(0xFF06B6D4) else Color(0xFF242938)
                                    )
                                ) {
                                    Text(label, color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }

                        // Pitch Shifting Slider
                        Text(
                            text = "Pitch Shift: $pitchSemitones Semitones",
                            color = Color(0xFFF97316),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        Slider(
                            value = pitchSemitones.toFloat(),
                            onValueChange = { pitchSemitones = it.toInt() },
                            valueRange = -24f..24f,
                            steps = 47
                        )
                    }
                }
                else -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF181A24)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "$activeTab Module Active",
                            color = Color(0xFF64748B),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}
