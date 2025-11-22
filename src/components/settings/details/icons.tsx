import { View } from "react-native"

export function TeamIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, marginTop: 1 }} />
        <View style={{ width: 8, height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderColor: color, borderBottomWidth: 0, marginTop: -1 }} />
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginLeft: -1 }}>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, marginTop: 1 }} />
        <View style={{ width: 8, height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderColor: color, borderBottomWidth: 0, marginTop: -1 }} />
      </View>
    </View>
  )
}

export function SuppliersIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14, height: 12, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ width: 6, height: 8, borderWidth: 1.5, borderColor: color, marginBottom: 1 }} />
      </View>
    </View>
  )
}

export function LocationIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 12,
        height: 16,
        borderWidth: 1.5,
        borderColor: color,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 0,
        transform: [{ rotate: '45deg' }],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      </View>
    </View>
  )
}

export function LoyaltyIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
        </View>
      </View>
    </View>
  )
}

export function PaymentIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 20, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: color }}>
        <View style={{ width: 14, height: 2, backgroundColor: color, marginTop: 3, marginLeft: 2 }} />
      </View>
    </View>
  )
}
