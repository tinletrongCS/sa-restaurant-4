package com.irms.inventory_service.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE_NAME = "inventory_deduct_queue";
    public static final String EXCHANGE_NAME = "restaurant_exchange";
    public static final String ROUTING_KEY = "order.created";

    @Bean
    public Queue inventoryQueue() {
        return new Queue(QUEUE_NAME, true); // true = giữ queue lại dù server có sập
    }

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(EXCHANGE_NAME);
    }

    @Bean
    public Binding binding(Queue inventoryQueue, TopicExchange orderExchange) {
        return BindingBuilder.bind(inventoryQueue).to(orderExchange).with(ROUTING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}