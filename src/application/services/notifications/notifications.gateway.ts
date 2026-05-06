import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.log(`Cliente WebSocket conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente WebSocket desconectado: ${client.id}`);
  }

  emitNewAppointmentRequest(payload: {
    id: number;
    clientName: string;
    patientName: string | null;
    reason: string;
    preferredDate: string | null;
    preferredTime: string | null;
    createdAt: Date;
  }): void {
    this.server.emit('nueva-solicitud-cita', payload);
  }

  emitAppointmentRequestStatusUpdated(payload: {
    id: number;
    status: string;
    staffNotes: string | null;
  }): void {
    this.server.emit('solicitud-cita-actualizada', payload);
  }
}
